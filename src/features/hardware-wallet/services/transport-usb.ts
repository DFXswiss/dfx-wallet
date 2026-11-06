import { Platform } from 'react-native';
import type { BitboxTransport, HardwareWalletDevice } from './types';

/**
 * USB HID transport for BitBox02 (Android only).
 *
 * Uses the native BitboxHid Expo module (modules/bitbox-hid/).
 * The native module wraps Android USB Host API to communicate
 * with BitBox02 over USB HID (VID: 0x03EB, PID: 0x2403).
 */
export class UsbTransport implements BitboxTransport {
  private mod: typeof import('@modules/bitbox-hid/src') | null = null;

  constructor() {
    if (Platform.OS !== 'android') {
      throw new Error('USB HID transport is only available on Android');
    }
  }

  private async getModule() {
    if (!this.mod) {
      this.mod = await import('@modules/bitbox-hid/src');
    }
    return this.mod;
  }

  async open(deviceId: string): Promise<void> {
    const mod = await this.getModule();
    const success = await mod.open(deviceId);
    if (!success) throw new Error('Failed to open USB device');
  }

  async write(data: Uint8Array): Promise<number> {
    const mod = await this.getModule();
    return mod.write(data);
  }

  async read(): Promise<Uint8Array> {
    const mod = await this.getModule();
    return mod.read(5000);
  }

  async close(): Promise<void> {
    const mod = await this.getModule();
    return mod.close();
  }
}

/**
 * Scan for BitBox02 devices via USB on Android.
 */
export async function scanUsbDevices(): Promise<HardwareWalletDevice[]> {
  if (Platform.OS !== 'android') return [];

  try {
    const mod = await import('@modules/bitbox-hid/src');
    const devices = await mod.enumerate();
    return devices.map((d) => ({
      id: d.deviceId,
      name: d.deviceName || 'BitBox02',
      type: 'bitbox02' as const,
      transport: 'usb' as const,
    }));
  } catch {
    return [];
  }
}
