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
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class BitboxHidModule : Module() {

    companion object {
        const val BITBOX02_VENDOR_ID = 0x03EB
        const val BITBOX02_PRODUCT_ID = 0x2403
        const val ACTION_USB_PERMISSION = "swiss.dfx.wallet.USB_PERMISSION"
        const val HID_REPORT_SIZE = 64
        const val READ_TIMEOUT_MS = 5000
    }

    private var usbManager: UsbManager? = null
    private var connection: UsbDeviceConnection? = null
    private var usbInterface: UsbInterface? = null
    private var endpointIn: UsbEndpoint? = null
    private var endpointOut: UsbEndpoint? = null

    override fun definition() = ModuleDefinition {
        Name("BitboxHid")

        OnCreate {
            usbManager = appContext.reactContext?.getSystemService(Context.USB_SERVICE) as? UsbManager
        }

        AsyncFunction("enumerate") {
            val manager = usbManager ?: return@AsyncFunction emptyList<Map<String, Any>>()
            val devices = manager.deviceList.values
                .filter { it.vendorId == BITBOX02_VENDOR_ID && it.productId == BITBOX02_PRODUCT_ID }
                .map { device ->
                    mapOf(
                        "deviceId" to device.deviceId.toString(),
                        "vendorId" to device.vendorId,
                        "productId" to device.productId,
                        "deviceName" to (device.productName ?: "BitBox02")
                    )
                }
            devices
        }

        AsyncFunction("open") { deviceId: String ->
            val manager = usbManager ?: throw Exception("USB Manager not available")
            val device = manager.deviceList.values
                .find { it.deviceId.toString() == deviceId }
                ?: throw Exception("Device not found: $deviceId")

            if (!manager.hasPermission(device)) {
                requestPermission(device)
                throw Exception("USB permission not granted. Please allow USB access and try again.")
            }

            openDevice(device)
            true
        }

        AsyncFunction("write") { data: List<Int> ->
            val conn = connection ?: throw Exception("No device connected")
            val endpoint = endpointOut ?: throw Exception("No output endpoint")

            val bytes = ByteArray(HID_REPORT_SIZE + 1)
            // First byte is report ID (0x00 for default)
            bytes[0] = 0x00
            for (i in data.indices) {
                if (i < HID_REPORT_SIZE) {
                    bytes[i + 1] = data[i].toByte()
                }
            }

            val sent = conn.bulkTransfer(endpoint, bytes, bytes.size, READ_TIMEOUT_MS)
            if (sent < 0) throw Exception("USB write failed")
            sent
        }

        AsyncFunction("read") { timeoutMs: Int ->
            val conn = connection ?: throw Exception("No device connected")
            val endpoint = endpointIn ?: throw Exception("No input endpoint")

            val buffer = ByteArray(HID_REPORT_SIZE)
            val received = conn.bulkTransfer(endpoint, buffer, buffer.size, timeoutMs)
            if (received < 0) throw Exception("USB read failed or timed out")

            buffer.take(received).map { it.toInt() and 0xFF }
        }

        AsyncFunction("close") {
            closeDevice()
        }

        Function("isConnected") {
            connection != null
        }

        OnDestroy {
            closeDevice()
        }
    }

    private fun openDevice(device: UsbDevice) {
        val manager = usbManager ?: throw Exception("USB Manager not available")

        // Find HID interface
        var hidInterface: UsbInterface? = null
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == UsbConstants.USB_CLASS_HID) {
                hidInterface = iface
                break
            }
        }
        if (hidInterface == null) throw Exception("No HID interface found on device")

        // Find endpoints
        var epIn: UsbEndpoint? = null
        var epOut: UsbEndpoint? = null
        for (i in 0 until hidInterface.endpointCount) {
            val ep = hidInterface.getEndpoint(i)
            if (ep.direction == UsbConstants.USB_DIR_IN) {
                epIn = ep
            } else if (ep.direction == UsbConstants.USB_DIR_OUT) {
                epOut = ep
            }
        }
        if (epIn == null || epOut == null) throw Exception("Missing HID endpoints")

        // Open connection
        val conn = manager.openDevice(device) ?: throw Exception("Failed to open USB device")
        if (!conn.claimInterface(hidInterface, true)) {
            conn.close()
            throw Exception("Failed to claim HID interface")
        }

        connection = conn
        usbInterface = hidInterface
        endpointIn = epIn
        endpointOut = epOut
    }

    private fun closeDevice() {
        connection?.let { conn ->
            usbInterface?.let { iface ->
                conn.releaseInterface(iface)
            }
            conn.close()
        }
        connection = null
        usbInterface = null
        endpointIn = null
        endpointOut = null
    }

    private fun requestPermission(device: UsbDevice) {
        val context = appContext.reactContext ?: return
        val manager = usbManager ?: return

        val permissionIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(ACTION_USB_PERMISSION),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        manager.requestPermission(device, permissionIntent)
    }
}
