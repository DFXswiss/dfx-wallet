import { BleManager, Device, type Characteristic, type Subscription } from 'react-native-ble-plx';
import type { BitboxTransport, HardwareWalletDevice } from './types';

/**
 * BitBox02 Nova BLE service UUIDs.
 *
 * TODO: These need to be verified from BitBox02 Nova specs.
 * The actual UUIDs will be available once the Nova BLE protocol is documented.
 * For now, using placeholder UUIDs — update when BitBox publishes BLE specs.
 */
const BITBOX_NOVA_SERVICE_UUID = '0000bb02-0000-1000-8000-00805f9b34fb';
const BITBOX_NOVA_WRITE_CHAR_UUID = '0000bb03-0000-1000-8000-00805f9b34fb';
const BITBOX_NOVA_NOTIFY_CHAR_UUID = '0000bb04-0000-1000-8000-00805f9b34fb';

/** BLE scan timeout in milliseconds */
const SCAN_TIMEOUT_MS = 10000;

/** Max BLE MTU for data chunks */
const BLE_CHUNK_SIZE = 128;

/** How long a read() waits for the next notification frame */
const READ_TIMEOUT_MS = 10000;

let bleManager: BleManager | null = null;

function getManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

/**
 * BLE transport for BitBox02 Nova (Android + iOS).
 *
 * Communication:
 * - Write: split data into BLE MTU-sized chunks, send via write characteristic
 * - Read: subscribe to notify characteristic, buffer incoming data
 * - Protocol on top of raw bytes is identical to USB (Noise XX → Protobuf)
 */
/** A read() call waiting for the next notification frame. */
type ReadWaiter = {
  resolve: (data: Uint8Array) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class BleTransport implements BitboxTransport {
  private device: Device | null = null;
  private writeChar: Characteristic | null = null;
  private notifySubscription: Subscription | null = null;
  private readBuffer: Uint8Array[] = [];
  private readWaiters: ReadWaiter[] = [];

  async connectToDevice(deviceId: string): Promise<void> {
    // A reconnect must not leak the previous session: its monitor would keep
    // feeding frames from the old device into this transport's read buffer —
    // cross-device pollution on the Noise channel.
    if (this.device) await this.close();

    const manager = getManager();

    this.device = await manager.connectToDevice(deviceId, {
      requestMTU: 185,
    });

    await this.device.discoverAllServicesAndCharacteristics();

    const services = await this.device.services();
    const bbService = services.find((s) => s.uuid === BITBOX_NOVA_SERVICE_UUID);
    if (!bbService) throw new Error('BitBox02 Nova BLE service not found');

    const characteristics = await bbService.characteristics();

    this.writeChar = characteristics.find((c) => c.uuid === BITBOX_NOVA_WRITE_CHAR_UUID) ?? null;
    if (!this.writeChar) throw new Error('Write characteristic not found');

    const notifyChar = characteristics.find((c) => c.uuid === BITBOX_NOVA_NOTIFY_CHAR_UUID);
    if (!notifyChar) throw new Error('Notify characteristic not found');

    this.notifySubscription = notifyChar.monitor((error, char) => {
      if (error) {
        // Link loss / monitor failure mid-ceremony: wake every pending read with
        // the real error instead of letting it wait out the full READ_TIMEOUT_MS
        // and then fail with a generic 'BLE read timeout' that hides the cause.
        // Fail fast and fail honest — the Noise ceremony aborts cleanly.
        for (const waiter of this.readWaiters.splice(0)) {
          clearTimeout(waiter.timer);
          waiter.reject(error);
        }
        return;
      }
      if (!char?.value) return;
      const bytes = base64ToBytes(char.value);
      const waiter = this.readWaiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve(bytes);
      } else {
        this.readBuffer.push(bytes);
      }
    });
  }

  async write(data: Uint8Array): Promise<number> {
    if (!this.writeChar) throw new Error('BLE not connected');

    let offset = 0;
    while (offset < data.length) {
      const chunk = data.slice(offset, offset + BLE_CHUNK_SIZE);
      const b64 = bytesToBase64(chunk);
      await this.writeChar.writeWithResponse(b64);
      offset += chunk.length;
    }
    return data.length;
  }

  async read(): Promise<Uint8Array> {
    // Fail fast instead of waiting out the 10s timeout on a transport that
    // is not (or no longer) connected.
    if (!this.device) throw new Error('BLE not connected');

    if (this.readBuffer.length > 0) {
      return this.readBuffer.shift()!;
    }

    return new Promise<Uint8Array>((resolve, reject) => {
      const waiter: ReadWaiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const idx = this.readWaiters.indexOf(waiter);
          if (idx !== -1) {
            this.readWaiters.splice(idx, 1);
            reject(new Error('BLE read timeout'));
          }
        }, READ_TIMEOUT_MS),
      };
      // FIFO waiter queue: concurrent reads each get their own frame in
      // arrival order — no caller is silently dropped.
      this.readWaiters.push(waiter);
    });
  }

  async close(): Promise<void> {
    // Stop the notification feed first so a frame arriving mid-close cannot
    // repopulate the buffer of a dead transport.
    this.notifySubscription?.remove();
    this.notifySubscription = null;

    // A pending read must fail loudly on disconnect — never hang forever.
    for (const waiter of this.readWaiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('BLE transport closed'));
    }

    if (this.device) {
      await this.device.cancelConnection();
      this.device = null;
    }
    this.writeChar = null;
    this.readBuffer = [];
  }
}

/**
 * Scan for BitBox02 Nova devices via BLE.
 * Works on both Android and iOS.
 */
export async function scanBleDevices(): Promise<HardwareWalletDevice[]> {
  const manager = getManager();
  const found: HardwareWalletDevice[] = [];

  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _timeout = setTimeout(() => {
      void manager.stopDeviceScan();
      resolve(found);
    }, SCAN_TIMEOUT_MS);

    void manager.startDeviceScan(
      [BITBOX_NOVA_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error || !device) return;

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

/** Convert Uint8Array to base64 string */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Convert base64 string to Uint8Array */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i is bounded by binary.length above
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
