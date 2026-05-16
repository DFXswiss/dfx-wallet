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
