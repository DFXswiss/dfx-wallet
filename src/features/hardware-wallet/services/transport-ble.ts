import { BleManager, Device, type Characteristic } from 'react-native-ble-plx';
import type { BitboxTransport, HardwareWalletDevice } from './types';
import {
  BITBOX_NOVA_NOTIFY_CHAR_UUID,
  BITBOX_NOVA_SERVICE_UUID,
  BITBOX_NOVA_WRITE_CHAR_UUID,
  BLE_CHUNK_SIZE,
  BLE_DEFAULT_MTU,
  BLE_DEFAULT_READ_TIMEOUT_MS,
  BLE_DEFAULT_SCAN_TIMEOUT_MS,
  isBleEnabled,
} from './ble-config';
import { HwPermissionDeniedError, HwTransportFailureError } from './errors';

/**
 * Shared BleManager. Injectable so multiple features can share a single
 * native peer or so tests can substitute a fake. The default factory is
 * lazy: the manager is created on first request rather than on import.
 */
let sharedManager: BleManager | null = null;

export function setBleManager(manager: BleManager | null): void {
  sharedManager = manager;
}

function getManager(): BleManager {
  if (!sharedManager) {
    sharedManager = new BleManager();
  }
  return sharedManager;
}

/**
 * BLE transport for BitBox02 Nova (Android + iOS).
 *
 * Read queue: BLE notifications can arrive at any time. The class buffers
 * notifications received without a pending reader, and queues readers
 * waiting for notifications. A single notification → single reader pairing.
 * Concurrent read() calls do not lose messages.
 */
export class BleTransport implements BitboxTransport {
  private device: Device | null = null;
  private writeChar: Characteristic | null = null;
  private readBuffer: Uint8Array[] = [];
  private waiters: Array<{
    resolve: (data: Uint8Array) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private monitorSub: { remove: () => void } | null = null;
  private readonly readTimeoutMs: number;

  constructor(opts: { readTimeoutMs?: number } = {}) {
    if (!isBleEnabled()) {
      throw new HwTransportFailureError(
        'BLE transport is disabled in this build. Set EXPO_PUBLIC_ENABLE_BITBOX_BLE=true and verify BitBox Nova UUIDs before enabling.',
      );
    }
    this.readTimeoutMs = opts.readTimeoutMs ?? BLE_DEFAULT_READ_TIMEOUT_MS;
  }

  async connectToDevice(deviceId: string): Promise<void> {
    const manager = getManager();

    try {
      this.device = await manager.connectToDevice(deviceId, { requestMTU: BLE_DEFAULT_MTU });
    } catch (err) {
      throw new HwTransportFailureError(`BLE connect failed: ${describeError(err)}`, asError(err));
    }

    try {
      await this.device.discoverAllServicesAndCharacteristics();
    } catch (err) {
      throw new HwTransportFailureError(
        `BLE service discovery failed: ${describeError(err)}`,
        asError(err),
      );
    }

    const services = await this.device.services();
    const bbService = services.find(
      (s) => s.uuid.toLowerCase() === BITBOX_NOVA_SERVICE_UUID.toLowerCase(),
    );
    if (!bbService) {
      throw new HwTransportFailureError('BitBox02 Nova BLE service not found on device');
    }

    const characteristics = await bbService.characteristics();
    this.writeChar =
      characteristics.find(
        (c) => c.uuid.toLowerCase() === BITBOX_NOVA_WRITE_CHAR_UUID.toLowerCase(),
      ) ?? null;
    if (!this.writeChar) throw new HwTransportFailureError('Write characteristic not found');

    const notifyChar = characteristics.find(
      (c) => c.uuid.toLowerCase() === BITBOX_NOVA_NOTIFY_CHAR_UUID.toLowerCase(),
    );
    if (!notifyChar) throw new HwTransportFailureError('Notify characteristic not found');

    this.monitorSub = notifyChar.monitor((error, char) => {
      if (error) {
        const failure = new HwTransportFailureError(
          `BLE notify error: ${describeError(error)}`,
          asError(error),
        );
        this.failAllWaiters(failure);
        return;
      }
      if (!char?.value) return;
      const bytes = base64ToBytes(char.value);
      const waiter = this.waiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve(bytes);
      } else {
        this.readBuffer.push(bytes);
      }
    });
  }

  async write(data: Uint8Array): Promise<number> {
    if (!this.writeChar)
      throw new HwTransportFailureError('BLE not connected (no write characteristic)');

    let offset = 0;
    while (offset < data.length) {
      const chunk = data.slice(offset, offset + BLE_CHUNK_SIZE);
      const b64 = bytesToBase64(chunk);
      try {
        await this.writeChar.writeWithResponse(b64);
      } catch (err) {
        throw new HwTransportFailureError(
          `BLE write failed at offset ${offset}: ${describeError(err)}`,
          asError(err),
        );
      }
      offset += chunk.length;
    }
    return data.length;
  }

  async read(): Promise<Uint8Array> {
    const buffered = this.readBuffer.shift();
    if (buffered) return buffered;

    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new HwTransportFailureError(`BLE read timeout after ${this.readTimeoutMs}ms`));
      }, this.readTimeoutMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  async close(): Promise<void> {
    this.monitorSub?.remove();
    this.monitorSub = null;
    this.failAllWaiters(new HwTransportFailureError('transport closed'));
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch {
        // Connection may already be gone — that's the intent of close().
      }
      this.device = null;
    }
    this.writeChar = null;
    this.readBuffer = [];
  }

  private failAllWaiters(err: Error): void {
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    this.waiters = [];
  }
}

/**
 * Scan for BitBox02 Nova devices via BLE. Returns an empty array (not an
 * error) when BLE is disabled by build flag, so the UI can simply not show
 * BLE devices instead of blowing up.
 */
export async function scanBleDevices(
  opts: { timeoutMs?: number } = {},
): Promise<HardwareWalletDevice[]> {
  if (!isBleEnabled()) return [];
  const timeoutMs = opts.timeoutMs ?? BLE_DEFAULT_SCAN_TIMEOUT_MS;

  const manager = getManager();
  const found: HardwareWalletDevice[] = [];

  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      cleanup();
      resolve(found);
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeoutHandle);
      void manager.stopDeviceScan();
    }

    void manager.startDeviceScan(
      [BITBOX_NOVA_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          cleanup();
          // BLE errors are surface-able as Permission or Transport class.
          // Without a stable error-code surface from react-native-ble-plx
          // we string-match conservatively here; widen only if real-world
          // findings warrant.
          if (/not[ -]?authorized|denied|permission/i.test(error.message ?? '')) {
            reject(new HwPermissionDeniedError(detectPlatform()));
            return;
          }
          reject(new HwTransportFailureError(`BLE scan failed: ${error.message}`, error as Error));
          return;
        }
        if (!device) return;
        if (!found.some((d) => d.id === device.id)) {
          found.push({
            id: device.id,
            name: device.name ?? device.localName ?? 'BitBox02 Nova',
            type: 'bitbox02-nova',
            transport: 'ble',
          });
        }
      },
    );
  });
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return JSON.stringify(err);
}

function asError(err: unknown): Error | undefined {
  return err instanceof Error ? err : undefined;
}

function detectPlatform(): 'android' | 'ios' | 'unknown' {
  const Platform = (globalThis as { Platform?: { OS?: string } }).Platform;
  if (Platform?.OS === 'android') return 'android';
  if (Platform?.OS === 'ios') return 'ios';
  return 'unknown';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i bounded by binary.length
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
