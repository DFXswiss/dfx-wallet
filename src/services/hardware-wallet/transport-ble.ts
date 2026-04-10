import type { BitboxTransport, HardwareWalletDevice } from './types';

/**
 * BLE transport for BitBox02 Nova (Android + iOS).
 *
 * Implementation strategy:
 * - Uses react-native-ble-plx for BLE communication
 * - BitBox02 Nova advertises a specific BLE service UUID
 * - Communication via BLE GATT characteristics (write + notify)
 *
 * Dependencies needed:
 *   npm install react-native-ble-plx
 *
 * BLE protocol:
 *   1. Scan for devices advertising BitBox02 Nova service UUID
 *   2. Connect to device
 *   3. Discover GATT services and characteristics
 *   4. Use write characteristic for sending data
 *   5. Subscribe to notify characteristic for receiving data
 *   6. On top of raw bytes: Noise XX handshake → encrypted channel → Protobuf messages
 *
 * BitBox02 Nova BLE identifiers:
 *   Service UUID:        TBD (need to verify from BitBox02 Nova specs)
 *   Write Characteristic: TBD
 *   Notify Characteristic: TBD
 *
 * Note: The Noise XX handshake and Protobuf message layer are identical
 * to USB — only the raw byte transport differs.
 */
export class BleTransport implements BitboxTransport {
  // private device: Device | null = null;
  // private writeCharacteristic: Characteristic | null = null;
  // private readBuffer: Uint8Array[] = [];

  async write(_data: Uint8Array): Promise<number> {
    // TODO: Split data into BLE MTU-sized chunks
    // await this.writeCharacteristic.writeWithResponse(base64encode(chunk))
    throw new Error('BLE transport not yet implemented');
  }

  async read(): Promise<Uint8Array> {
    // TODO: Read from notify buffer (populated by BLE subscription)
    throw new Error('BLE transport not yet implemented');
  }

  async close(): Promise<void> {
    // TODO: await this.device?.cancelConnection()
    throw new Error('BLE transport not yet implemented');
  }
}

/**
 * Scan for BitBox02 Nova devices via BLE.
 * Works on both Android and iOS.
 */
export async function scanBleDevices(): Promise<HardwareWalletDevice[]> {
  // TODO:
  // const manager = new BleManager();
  // await manager.startDeviceScan([BITBOX_NOVA_SERVICE_UUID], null, (error, device) => {
  //   if (device?.name?.includes('BitBox')) {
  //     found.push({
  //       id: device.id,
  //       name: device.name ?? 'BitBox02 Nova',
  //       type: 'bitbox02-nova',
  //       transport: 'ble',
  //     });
  //   }
  // });
  return [];
}
