import { Platform } from 'react-native';
import type { BitboxTransport, HardwareWalletDevice } from './types';
import { HwPermissionDeniedError, HwTransportFailureError } from './errors';

/**
 * USB HID transport for BitBox02 (Android only).
 *
 * Errors are surfaced as typed exceptions instead of being swallowed:
 *   - HwPermissionDeniedError when Android USB permission is not granted.
 *   - HwTransportFailureError for IO faults, busy device, native crashes.
 *
 * Errors are NOT remapped to "no devices" — the UI distinguishes
 * "scanned and found nothing" from "tried to scan but couldn't".
 */
export class UsbTransport implements BitboxTransport {
  private mod: typeof import('@modules/bitbox-hid/src') | null = null;
  private readonly readTimeoutMs: number;

  constructor(opts: { readTimeoutMs?: number } = {}) {
    if (Platform.OS !== 'android') {
      throw new HwTransportFailureError('USB HID transport is only available on Android');
    }
    this.readTimeoutMs = opts.readTimeoutMs ?? 30_000;
  }

  private async getModule() {
    if (!this.mod) {
      this.mod = await import('@modules/bitbox-hid/src');
    }
    return this.mod;
  }

  async open(deviceId: string): Promise<void> {
    const mod = await this.getModule();
    let success: boolean;
    try {
      success = await mod.open(deviceId);
    } catch (err) {
      throw classifyOpenError(err);
    }
    if (!success) {
      throw new HwTransportFailureError('Failed to open USB device (driver returned false)');
    }
  }

  async write(data: Uint8Array): Promise<number> {
    const mod = await this.getModule();
    try {
      return await mod.write(data);
    } catch (err) {
      throw new HwTransportFailureError(`USB write failed: ${stringify(err)}`, asError(err));
    }
  }

  async read(): Promise<Uint8Array> {
    const mod = await this.getModule();
    try {
      return await mod.read(this.readTimeoutMs);
    } catch (err) {
      throw new HwTransportFailureError(`USB read failed: ${stringify(err)}`, asError(err));
    }
  }

  async close(): Promise<void> {
    const mod = await this.getModule();
    try {
      return await mod.close();
    } catch (err) {
      // Close errors during teardown are common (device already gone);
      // surface a typed failure rather than swallow them, but with
      // descriptive context so the UI can decide to ignore.
      throw new HwTransportFailureError(`USB close failed: ${stringify(err)}`, asError(err));
    }
  }
}

/**
 * Scan for BitBox02 devices via USB on Android. Distinguishes "no Android",
 * "permission denied", and "no devices found" as distinct conditions.
 */
export async function scanUsbDevices(): Promise<HardwareWalletDevice[]> {
  if (Platform.OS !== 'android') return [];

  let mod: typeof import('@modules/bitbox-hid/src');
  try {
    mod = await import('@modules/bitbox-hid/src');
  } catch (err) {
    // The native module is unavailable in this build (likely a managed
    // workflow or an iOS-only fork). Empty list, not a crash.
    return [];
  }

  let devices: { deviceId: string; deviceName?: string }[];
  try {
    devices = await mod.enumerate();
  } catch (err) {
    throw classifyOpenError(err);
  }

  return devices.map((d) => ({
    id: d.deviceId,
    name: d.deviceName || 'BitBox02',
    type: 'bitbox02' as const,
    transport: 'usb' as const,
  }));
}

function classifyOpenError(err: unknown): Error {
  const msg = stringify(err);
  if (/permission|access denied|not allowed/i.test(msg)) {
    return new HwPermissionDeniedError('android');
  }
  if (/busy|in use|already opened/i.test(msg)) {
    return new HwTransportFailureError(
      'USB device is busy (another app may be holding it)',
      asError(err),
    );
  }
  return new HwTransportFailureError(`USB error: ${msg}`, asError(err));
}

function stringify(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function asError(err: unknown): Error | undefined {
  return err instanceof Error ? err : undefined;
}
