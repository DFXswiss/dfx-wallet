/**
 * Structural-contract regression for the Kotlin BitBox HID native module
 * (audit Tier 2: CC-20 + CC-21).
 *
 * The dfx-wallet CI does not run androidTest / instrumentation tests,
 * so we cannot exercise the Kotlin module against a real Android USB
 * stack here. What we CAN do — and what these tests do — is assert
 * the load-bearing structural invariants by source inspection:
 *
 *   - CC-20: every USB I/O takes the IO mutex AND switches to
 *     Dispatchers.IO; the mutable per-connection fields are @Volatile.
 *   - CC-21: a BroadcastReceiver is registered for the permission
 *     action; PendingIntent uses FLAG_IMMUTABLE on Android 12+; the
 *     intent has setPackage() applied for explicit-broadcast routing;
 *     awaitPermission suspends instead of throwing the previous
 *     "tap retry" footgun.
 *
 * These tests fail loudly if a future refactor accidentally removes
 * one of these protections — a meaningful safety net even without
 * device-side validation.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const KOTLIN_PATH = join(
  __dirname,
  '..',
  '..',
  'modules/bitbox-hid/android/src/main/java/swiss/dfx/wallet/bitbox/BitboxHidModule.kt',
);

describe('BitboxHidModule.kt — CC-20 (concurrency)', () => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-time KOTLIN_PATH is a fixed join of __dirname + literal segments
  const source = readFileSync(KOTLIN_PATH, 'utf8');

  it('imports kotlinx.coroutines.sync.Mutex and Dispatchers', () => {
    expect(source).toMatch(/import kotlinx\.coroutines\.sync\.Mutex/);
    expect(source).toMatch(/import kotlinx\.coroutines\.sync\.withLock/);
    expect(source).toMatch(/import kotlinx\.coroutines\.Dispatchers/);
    expect(source).toMatch(/import kotlinx\.coroutines\.withContext/);
  });

  it('declares a private ioMutex serialising every USB operation', () => {
    expect(source).toMatch(/private val ioMutex = Mutex\(\)/);
  });

  it('marks the mutable per-connection fields @Volatile', () => {
    expect(source).toMatch(/@Volatile private var connection: UsbDeviceConnection\?/);
    expect(source).toMatch(/@Volatile private var usbInterface: UsbInterface\?/);
    expect(source).toMatch(/@Volatile private var endpointIn: UsbEndpoint\?/);
    expect(source).toMatch(/@Volatile private var endpointOut: UsbEndpoint\?/);
  });

  it('wraps write/read/close/open in ioMutex.withLock + Dispatchers.IO', () => {
    // Each of the four async ops should appear once with the
    // canonical "ioMutex.withLock { withContext(Dispatchers.IO) { ... } }"
    // pattern. We assert at minimum 4 occurrences of withLock.
    const withLockCount = (source.match(/ioMutex\.withLock/g) ?? []).length;
    expect(withLockCount).toBeGreaterThanOrEqual(4);
    const dispatchersIoCount = (source.match(/withContext\(Dispatchers\.IO\)/g) ?? []).length;
    expect(dispatchersIoCount).toBeGreaterThanOrEqual(4);
  });

  it('closeDeviceLocked clears every connection-state field', () => {
    expect(source).toMatch(
      /connection = null[\s\S]*usbInterface = null[\s\S]*endpointIn = null[\s\S]*endpointOut = null/,
    );
  });
});

describe('BitboxHidModule.kt — CC-21 (USB-permission BroadcastReceiver)', () => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-time KOTLIN_PATH is a fixed join of __dirname + literal segments
  const source = readFileSync(KOTLIN_PATH, 'utf8');

  it('imports the BroadcastReceiver + IntentFilter + ContextCompat APIs', () => {
    expect(source).toMatch(/import android\.content\.BroadcastReceiver/);
    expect(source).toMatch(/import android\.content\.IntentFilter/);
    expect(source).toMatch(/import androidx\.core\.content\.ContextCompat/);
  });

  it('registers the receiver in OnCreate and unregisters in OnDestroy', () => {
    expect(source).toMatch(/OnCreate\s*\{[\s\S]*registerPermissionReceiver/);
    expect(source).toMatch(/OnDestroy\s*\{[\s\S]*unregisterPermissionReceiver/);
  });

  it('uses RECEIVER_NOT_EXPORTED on Android 14+ (TIRAMISU gate)', () => {
    expect(source).toMatch(/Build\.VERSION_CODES\.TIRAMISU/);
    expect(source).toMatch(/ContextCompat\.RECEIVER_NOT_EXPORTED/);
  });

  it('uses FLAG_IMMUTABLE on the PendingIntent (Android 12+ gate)', () => {
    expect(source).toMatch(/PendingIntent\.FLAG_IMMUTABLE/);
    // FLAG_MUTABLE must NOT remain — it was the previous footgun
    // letting a hostile co-resident receiver mutate the broadcast.
    expect(source).not.toMatch(/PendingIntent\.FLAG_MUTABLE/);
  });

  it('sets the intent package for explicit-broadcast routing', () => {
    expect(source).toMatch(/setPackage\(context\.packageName\)/);
  });

  it('awaitPermission suspends on a CompletableDeferred instead of throwing', () => {
    expect(source).toMatch(/private suspend fun awaitPermission/);
    expect(source).toMatch(/CompletableDeferred<Boolean>/);
    // And it has a timeout so a never-responding dialog cannot
    // hang the call indefinitely.
    expect(source).toMatch(/withTimeoutOrNull\(PERMISSION_TIMEOUT_MS\)/);
  });

  it('throws "permission denied" instead of the old "tap retry" error', () => {
    // Previous code path: throw Exception("USB permission not granted.
    //   Please allow USB access and try again."). The new path awaits
    // the system grant; only when the user denies (or times out) do
    // we surface an exception.
    expect(source).not.toMatch(/Please allow USB access and try again/);
    expect(source).toMatch(/USB permission denied/);
  });
});
