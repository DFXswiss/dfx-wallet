/**
 * BitBox02 Nova BLE configuration.
 *
 * The UUIDs below MUST be verified against an actual BitBox02 Nova or
 * the upstream BLE spec before this code path is enabled in store builds.
 *
 *   1. Use nRF Connect (Android / iOS) or equivalent to read the GATT
 *      service/characteristic UUIDs from a Nova in pairing mode.
 *   2. OR consult the official spec once published by BitBox.
 *   3. Replace the placeholders below.
 *   4. Bump BLE_CONFIG_VERSION so any cached scan results are invalidated.
 *
 * Until then the BLE transport is gated by EXPO_PUBLIC_ENABLE_BITBOX_BLE.
 * The default in store builds is "false" so users on iOS do not see a
 * scan that finds nothing.
 *
 * Sources to verify against:
 *   - https://github.com/BitBoxSwiss/bitbox02-firmware  (firmware repo)
 *   - https://shiftcrypto.ch/dev/                       (developer docs)
 *   - https://github.com/BitBoxSwiss/bitbox-api-rs/issues  (issue tracker)
 */

export const BLE_CONFIG_VERSION = '0.1.0-placeholder';

/** PLACEHOLDER — verify before shipping. */
export const BITBOX_NOVA_SERVICE_UUID = '0000bb02-0000-1000-8000-00805f9b34fb';

/** PLACEHOLDER — verify before shipping. */
export const BITBOX_NOVA_WRITE_CHAR_UUID = '0000bb03-0000-1000-8000-00805f9b34fb';

/** PLACEHOLDER — verify before shipping. */
export const BITBOX_NOVA_NOTIFY_CHAR_UUID = '0000bb04-0000-1000-8000-00805f9b34fb';

export const BLE_DEFAULT_SCAN_TIMEOUT_MS = 10_000;
export const BLE_DEFAULT_READ_TIMEOUT_MS = 30_000; // up from 10s — long user-confirm flows
export const BLE_DEFAULT_MTU = 185;
export const BLE_CHUNK_SIZE = 180; // up from 128; leaves ATT overhead headroom

/**
 * Whether the BLE transport is enabled in the current build. Wired to a
 * single env flag so a maintainer can flip it once UUIDs are verified.
 * Tests override via `enableForTest()`.
 */
let bleEnabled = process.env.EXPO_PUBLIC_ENABLE_BITBOX_BLE === 'true';

export function isBleEnabled(): boolean {
  return bleEnabled;
}

/** Test-only helper. Production code MUST NOT call this. */
export function enableBleForTest(on: boolean): void {
  bleEnabled = on;
}

/** Are the UUIDs still placeholders? Used to gate diagnostics / warnings. */
export function uuidsArePlaceholders(): boolean {
  return BLE_CONFIG_VERSION.includes('placeholder');
}
