import { BleManager, Device, type Characteristic } from 'react-native-ble-plx';
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
export class BleTransport implements BitboxTransport {
  private device: Device | null = null;
  private writeChar: Characteristic | null = null;
  private readBuffer: Uint8Array[] = [];
  private readResolve: ((data: Uint8Array) => void) | null = null;

  async connectToDevice(deviceId: string): Promise<void> {
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

    notifyChar.monitor((error, char) => {
      if (error || !char?.value) return;
      const bytes = base64ToBytes(char.value);
      if (this.readResolve) {
        const resolve = this.readResolve;
        this.readResolve = null;
        resolve(bytes);
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
    if (this.readBuffer.length > 0) {
      return this.readBuffer.shift()!;
    }

    return new Promise<Uint8Array>((resolve, reject) => {
      this.readResolve = resolve;
      setTimeout(() => {
        if (this.readResolve === resolve) {
          this.readResolve = null;
          reject(new Error('BLE read timeout'));
        }
      }, 10000);
    });
  }

  async close(): Promise<void> {
    if (this.device) {
      await this.device.cancelConnection();
      this.device = null;
    }
    this.writeChar = null;
    this.readBuffer = [];
    this.readResolve = null;
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
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
