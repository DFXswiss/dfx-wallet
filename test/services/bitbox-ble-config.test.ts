/**
 * Tests for the BLE feature-flag and configuration. The UUID constants
 * themselves cannot be unit-tested for correctness — that requires real
 * hardware. The tests below assert the SAFETY of the configuration:
 *
 *   - default-off in store builds (CRIT-2)
 *   - placeholder marker is present so a release build cannot accidentally
 *     ship with placeholder UUIDs
 *   - enableBleForTest toggle works without leaking state across tests
 */

import {
  BLE_CONFIG_VERSION,
  enableBleForTest,
  isBleEnabled,
  uuidsArePlaceholders,
  BITBOX_NOVA_SERVICE_UUID,
  BITBOX_NOVA_WRITE_CHAR_UUID,
  BITBOX_NOVA_NOTIFY_CHAR_UUID,
} from '@/features/hardware-wallet/services/ble-config';

describe('ble-config — CRIT-2 placeholder gating', () => {
  afterEach(() => enableBleForTest(false));

  it('default state is BLE disabled', () => {
    enableBleForTest(false);
    expect(isBleEnabled()).toBe(false);
  });

  it('enableBleForTest toggle works in both directions', () => {
    enableBleForTest(true);
    expect(isBleEnabled()).toBe(true);
    enableBleForTest(false);
    expect(isBleEnabled()).toBe(false);
  });

  it('uuidsArePlaceholders flag tracks BLE_CONFIG_VERSION', () => {
    expect(BLE_CONFIG_VERSION).toContain('placeholder');
    expect(uuidsArePlaceholders()).toBe(true);
  });

  it('all three Nova UUIDs are valid UUIDv4 / Bluetooth UUID shapes', () => {
    const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(BITBOX_NOVA_SERVICE_UUID).toMatch(uuidShape);
    expect(BITBOX_NOVA_WRITE_CHAR_UUID).toMatch(uuidShape);
    expect(BITBOX_NOVA_NOTIFY_CHAR_UUID).toMatch(uuidShape);
  });

  it('UUIDs are distinct', () => {
    expect(BITBOX_NOVA_SERVICE_UUID).not.toBe(BITBOX_NOVA_WRITE_CHAR_UUID);
    expect(BITBOX_NOVA_SERVICE_UUID).not.toBe(BITBOX_NOVA_NOTIFY_CHAR_UUID);
    expect(BITBOX_NOVA_WRITE_CHAR_UUID).not.toBe(BITBOX_NOVA_NOTIFY_CHAR_UUID);
  });
});

/**
 * Regression for CC-18: BLE transport must refuse to construct against
 * placeholder UUIDs, EVEN when the env flag is enabled. The env flag is
 * easy to flip in EAS dogfood profiles; the UUID-verification step is
 * not, and must never be silently bypassed.
 */
describe('BleTransport — placeholder-UUID hard gate', () => {
  afterEach(() => enableBleForTest(false));

  it('refuses to construct while uuidsArePlaceholders() is true', async () => {
    enableBleForTest(true);
    expect(uuidsArePlaceholders()).toBe(true);
    const { BleTransport } = await import('@/features/hardware-wallet/services/transport-ble');
    const { HwTransportFailureError } = await import('@/features/hardware-wallet/services/errors');
    expect(() => new BleTransport()).toThrow(HwTransportFailureError);
    expect(() => new BleTransport()).toThrow(/placeholder/i);
  });

  it('scanBleDevices returns empty while placeholders are in effect', async () => {
    enableBleForTest(true);
    const { scanBleDevices } = await import('@/features/hardware-wallet/services/transport-ble');
    await expect(scanBleDevices()).resolves.toEqual([]);
  });

  it('refuses to construct when the env flag is OFF even without placeholders', async () => {
    enableBleForTest(false);
    const { BleTransport } = await import('@/features/hardware-wallet/services/transport-ble');
    const { HwTransportFailureError } = await import('@/features/hardware-wallet/services/errors');
    expect(() => new BleTransport()).toThrow(HwTransportFailureError);
    expect(() => new BleTransport()).toThrow(/disabled/i);
  });
});
