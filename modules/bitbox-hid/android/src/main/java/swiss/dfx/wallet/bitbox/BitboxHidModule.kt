package swiss.dfx.wallet.bitbox

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * BitBox02 USB HID native module for Android.
 *
 * Audit Tier 2 hardening (CC-20 + CC-21):
 *
 * CC-20 — Concurrency safety.
 *   Every USB I/O (open / write / read / close) goes through `ioMutex`
 *   so the shared `connection` / `endpointIn` / `endpointOut` fields
 *   cannot be mutated by one coroutine while a parallel coroutine is
 *   blocked inside `bulkTransfer`. Pre-fix, two JS calls in flight
 *   could overlap on the same physical endpoint and tear apart a
 *   transfer; the only thing keeping it safe was that the WASM bridge
 *   happened to serialise its calls.
 *
 *   `@Volatile` on the mutable state fields establishes a memory
 *   barrier so the close-while-read race cannot observe a half-cleared
 *   field. Combined with the mutex, this guarantees the writer's
 *   `releaseInterface` + `close` are visible to the reader BEFORE its
 *   next `bulkTransfer` is issued.
 *
 *   All blocking I/O moves to `Dispatchers.IO`. Expo's default async
 *   dispatcher is intended for short-lived ops; long-blocking
 *   `bulkTransfer` calls would otherwise starve the module pool.
 *
 * CC-21 — USB-permission BroadcastReceiver.
 *   The Android USB-permission flow uses a BroadcastReceiver; the
 *   previous code requested the permission via PendingIntent but
 *   registered no receiver, so user-grants vanished and the only way
 *   to make the next `open` succeed was to relaunch the app entirely.
 *
 *   We now register a `RECEIVER_NOT_EXPORTED` receiver in OnCreate
 *   (Android 14+ semantics — earlier versions ignore the flag), with
 *   `intent.setPackage(context.packageName)` for explicit-broadcast
 *   delivery, and `FLAG_IMMUTABLE` on the PendingIntent (the previous
 *   FLAG_MUTABLE allowed a hostile co-resident receiver to mutate the
 *   broadcast extras). `open()` awaits a `CompletableDeferred<Boolean>`
 *   that the receiver completes when the user grants or denies.
 *
 * What this code does NOT do (hardware-validation-only):
 *   - Verify the user actually sees the system permission dialog on
 *     a real device. We can compile and structurally test the receiver
 *     wiring but the dialog itself is OS-mediated.
 *   - Detect device-swap via USB serial. Android 10+ requires
 *     android.permission.MANAGE_USB to read UsbDevice.serialNumber,
 *     which only system apps get. The JS-side xpub-fingerprint
 *     (CC-22) covers this case cross-platform.
 */
class BitboxHidModule : Module() {

    companion object {
        const val BITBOX02_VENDOR_ID = 0x03EB
        const val BITBOX02_PRODUCT_ID = 0x2403
        const val ACTION_USB_PERMISSION = "swiss.dfx.wallet.USB_PERMISSION"
        const val HID_REPORT_SIZE = 64
        // Default per-op timeouts. Kept long enough to absorb a slow
        // BitBox confirmation prompt; the bridge layer above this
        // applies its own per-call timeout that is the source of
        // truth for the user-visible "did the device respond" window.
        const val DEFAULT_WRITE_TIMEOUT_MS = 5000
        const val DEFAULT_READ_TIMEOUT_MS = 5000
        // Maximum time we wait for the user to grant USB permission
        // via the system dialog. After this we surface a clear error
        // instead of a stuck spinner.
        const val PERMISSION_TIMEOUT_MS = 60_000L
    }

    private var usbManager: UsbManager? = null

    // Mutable per-connection state. @Volatile establishes a happens-
    // before edge so a reader's first re-read after close() sees null
    // rather than a stale UsbEndpoint reference.
    @Volatile private var connection: UsbDeviceConnection? = null
    @Volatile private var usbInterface: UsbInterface? = null
    @Volatile private var endpointIn: UsbEndpoint? = null
    @Volatile private var endpointOut: UsbEndpoint? = null
    @Volatile private var closed: Boolean = false

    // Serialises every USB operation. Coroutines that own the mutex
    // see a consistent snapshot of (connection, endpointIn, endpointOut).
    private val ioMutex = Mutex()

    // Receiver state for the permission flow. The lifetime of
    // `pendingPermission` is one request-grant-or-deny cycle.
    private var permissionReceiver: BroadcastReceiver? = null
    @Volatile private var pendingPermission: CompletableDeferred<Boolean>? = null

    override fun definition() = ModuleDefinition {
        Name("BitboxHid")

        OnCreate {
            val ctx = appContext.reactContext
            usbManager = ctx?.getSystemService(Context.USB_SERVICE) as? UsbManager
            if (ctx != null) registerPermissionReceiver(ctx)
        }

        OnDestroy {
            unregisterPermissionReceiver()
            // Best-effort cleanup; the receiver may already be gone if
            // the OS killed the activity.
            try {
                closeDeviceLocked()
            } catch (_: Exception) {}
        }

        AsyncFunction("enumerate") {
            val manager = usbManager ?: return@AsyncFunction emptyList<Map<String, Any>>()
            manager.deviceList.values
                .filter { it.vendorId == BITBOX02_VENDOR_ID && it.productId == BITBOX02_PRODUCT_ID }
                .map { device ->
                    mapOf(
                        "deviceId" to device.deviceId.toString(),
                        "vendorId" to device.vendorId,
                        "productId" to device.productId,
                        "deviceName" to (device.productName ?: "BitBox02")
                    )
                }
        }

        AsyncFunction("open") { deviceId: String ->
            val manager = usbManager ?: throw Exception("USB Manager not available")
            val device = manager.deviceList.values
                .find { it.deviceId.toString() == deviceId }
                ?: throw Exception("Device not found: $deviceId")

            if (!manager.hasPermission(device)) {
                val granted = awaitPermission(device)
                if (!granted) {
                    throw Exception("USB permission denied by the user")
                }
            }

            // Serialise the open against any in-flight read/write so a
            // re-open cannot tear the previous session's endpoints out
            // from under a blocking bulkTransfer.
            ioMutex.withLock {
                withContext(Dispatchers.IO) {
                    closeDeviceLocked()
                    openDeviceLocked(device)
                }
            }
            true
        }

        AsyncFunction("write") { data: List<Int> ->
            ioMutex.withLock {
                withContext(Dispatchers.IO) {
                    val conn = connection ?: throw Exception("No device connected")
                    val endpoint = endpointOut ?: throw Exception("No output endpoint")

                    val bytes = ByteArray(HID_REPORT_SIZE + 1)
                    bytes[0] = 0x00 // Report ID
                    for (i in data.indices) {
                        if (i < HID_REPORT_SIZE) bytes[i + 1] = data[i].toByte()
                    }

                    val sent = conn.bulkTransfer(endpoint, bytes, bytes.size, DEFAULT_WRITE_TIMEOUT_MS)
                    if (sent < 0) throw Exception("USB write failed")
                    sent
                }
            }
        }

        AsyncFunction("read") { timeoutMs: Int ->
            ioMutex.withLock {
                withContext(Dispatchers.IO) {
                    val conn = connection ?: throw Exception("No device connected")
                    val endpoint = endpointIn ?: throw Exception("No input endpoint")

                    val buffer = ByteArray(HID_REPORT_SIZE)
                    val received = conn.bulkTransfer(endpoint, buffer, buffer.size, timeoutMs)
                    if (received < 0) throw Exception("USB read failed or timed out")
                    buffer.take(received).map { it.toInt() and 0xFF }
                }
            }
        }

        AsyncFunction("close") {
            ioMutex.withLock {
                withContext(Dispatchers.IO) {
                    closeDeviceLocked()
                }
            }
        }

        Function("isConnected") {
            connection != null
        }
    }

    /**
     * Open the device. Caller MUST hold `ioMutex`. Resets `closed`
     * so subsequent reads/writes proceed.
     */
    private fun openDeviceLocked(device: UsbDevice) {
        val manager = usbManager ?: throw Exception("USB Manager not available")

        var hidInterface: UsbInterface? = null
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == UsbConstants.USB_CLASS_HID) {
                hidInterface = iface
                break
            }
        }
        if (hidInterface == null) throw Exception("No HID interface found on device")

        var epIn: UsbEndpoint? = null
        var epOut: UsbEndpoint? = null
        for (i in 0 until hidInterface.endpointCount) {
            val ep = hidInterface.getEndpoint(i)
            if (ep.direction == UsbConstants.USB_DIR_IN) epIn = ep
            else if (ep.direction == UsbConstants.USB_DIR_OUT) epOut = ep
        }
        if (epIn == null || epOut == null) throw Exception("Missing HID endpoints")

        val conn = manager.openDevice(device) ?: throw Exception("Failed to open USB device")
        if (!conn.claimInterface(hidInterface, true)) {
            conn.close()
            throw Exception("Failed to claim HID interface")
        }

        connection = conn
        usbInterface = hidInterface
        endpointIn = epIn
        endpointOut = epOut
        closed = false
    }

    /**
     * Close the device. Caller SHOULD hold `ioMutex` for the
     * write/read/close paths; OnDestroy invokes this without the
     * mutex because the coroutine scope may already be cancelled.
     * Idempotent.
     */
    private fun closeDeviceLocked() {
        connection?.let { conn ->
            usbInterface?.let { iface ->
                try { conn.releaseInterface(iface) } catch (_: Exception) {}
            }
            try { conn.close() } catch (_: Exception) {}
        }
        connection = null
        usbInterface = null
        endpointIn = null
        endpointOut = null
        closed = true
    }

    /**
     * Register a private BroadcastReceiver for the USB-permission
     * action. The receiver completes `pendingPermission` so the
     * coroutine waiting in `awaitPermission` resumes.
     *
     * `RECEIVER_NOT_EXPORTED` (Android 14+) and the explicit package
     * filter on the PendingIntent (see awaitPermission) together
     * ensure only the OS USB service can deliver this broadcast.
     */
    private fun registerPermissionReceiver(context: Context) {
        if (permissionReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(_context: Context?, intent: Intent?) {
                if (intent?.action != ACTION_USB_PERMISSION) return
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                pendingPermission?.complete(granted)
                pendingPermission = null
            }
        }
        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(
                context,
                receiver,
                filter,
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
        } else {
            // Pre-Android-14 doesn't honour RECEIVER_NOT_EXPORTED but
            // also doesn't enforce export-by-default; the OS still
            // routes the broadcast to us correctly via setPackage().
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(receiver, filter)
        }
        permissionReceiver = receiver
    }

    private fun unregisterPermissionReceiver() {
        val ctx = appContext.reactContext ?: return
        val rcv = permissionReceiver ?: return
        try { ctx.unregisterReceiver(rcv) } catch (_: Exception) {}
        permissionReceiver = null
        pendingPermission?.complete(false)
        pendingPermission = null
    }

    /**
     * Request USB permission and SUSPEND until the user grants or
     * denies. Caches the deferred so a re-entry while a prompt is
     * already on screen returns the same Promise instead of stacking
     * another one (which Android would reject with a duplicate-
     * intent error anyway).
     *
     * On timeout we resume with `false` so the caller surfaces a
     * deterministic "permission denied" rather than a stuck Promise.
     */
    private suspend fun awaitPermission(device: UsbDevice): Boolean {
        val manager = usbManager ?: return false
        val context = appContext.reactContext ?: return false

        // Re-entry guard.
        pendingPermission?.let { return it.await() }
        val deferred = CompletableDeferred<Boolean>()
        pendingPermission = deferred

        val intent = Intent(ACTION_USB_PERMISSION).apply {
            setPackage(context.packageName) // explicit broadcast
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getBroadcast(context, 0, intent, flags)
        manager.requestPermission(device, pendingIntent)

        return withTimeoutOrNull(PERMISSION_TIMEOUT_MS) { deferred.await() } ?: run {
            pendingPermission = null
            false
        }
    }
}
