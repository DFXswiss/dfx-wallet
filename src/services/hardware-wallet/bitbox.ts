import { Platform } from 'react-native';
import type {
  BitboxTransport,
  HardwareWalletDevice,
  HardwareWalletProvider,
} from './types';
import { scanUsbDevices, UsbTransport } from './transport-usb';
import { BleTransport, scanBleDevices } from './transport-ble';

/**
 * BitBox02 hardware wallet provider.
 *
 * Dual-transport architecture:
 *   - USB HID: Standard BitBox02, Android only (native Expo module)
 *   - BLE: BitBox02 Nova, Android + iOS (react-native-ble-plx)
 *
 * Both transports implement BitboxTransport (ReadWrite trait equivalent).
 * The protocol stack on top (Noise XX → Protobuf → API) is shared.
 *
 * SDK: `bitbox-api` (npm, WASM from BitBoxSwiss/bitbox-api-rs)
 *
 * TODO: Once bitbox-api WASM is integrated:
 * 1. Load WASM binary
 * 2. Create PairingBitBox with our transport
 * 3. Perform Noise XX handshake
 * 4. Get PairedBitBox for signing operations
 */
export class BitboxProvider implements HardwareWalletProvider {
  private transport: BitboxTransport | null = null;
  private connectedDevice: HardwareWalletDevice | null = null;

  /**
   * Scan for BitBox02 devices via both USB (Android) and BLE (Android + iOS).
   */
  async scanDevices(): Promise<HardwareWalletDevice[]> {
    const results = await Promise.allSettled([
      scanUsbDevices(),
      scanBleDevices(),
    ]);

    const devices: HardwareWalletDevice[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        devices.push(...result.value);
      }
    }
    return devices;
  }

  /**
   * Connect to a BitBox02 device.
   * Automatically creates the right transport based on device type.
   */
  async connect(device: HardwareWalletDevice): Promise<void> {
    if (device.transport === 'usb' && Platform.OS !== 'android') {
      throw new Error('USB connection is only available on Android');
    }

    await this.disconnect();

    if (device.transport === 'usb') {
      const usb = new UsbTransport();
      await usb.open(device.id);
      this.transport = usb;
    } else {
      const ble = new BleTransport();
      await ble.connectToDevice(device.id);
      this.transport = ble;
    }

    this.connectedDevice = device;

    // TODO: Initialize bitbox-api WASM with this.transport
    // 1. const noise = new NoiseConfig();
    // 2. const pairing = await PairingBitBox.create(this.transport, noise);
    // 3. Display channel hash for user verification
    // 4. const paired = await pairing.confirm();
    // 5. Store paired instance for signing operations
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.connectedDevice = null;
  }

  async getEthAddress(_derivationPath?: string): Promise<string> {
    this.ensureConnected();
    // TODO: pairedBitBox.ethGetAddress(derivationPath ?? "m/44'/60'/0'/0/0")
    throw new Error('BitBox02 getEthAddress: awaiting bitbox-api WASM integration');
  }

  async getBtcAddress(_derivationPath?: string): Promise<string> {
    this.ensureConnected();
    // TODO: pairedBitBox.btcGetAddress(derivationPath ?? "m/84'/0'/0'/0/0")
    throw new Error('BitBox02 getBtcAddress: awaiting bitbox-api WASM integration');
  }

  async signEthTransaction(
    _chainId: number,
    _derivationPath: string,
    _rlpPayload: Uint8Array,
    _isEIP1559: boolean,
  ): Promise<{ r: string; s: string; v: number }> {
    this.ensureConnected();
    // TODO: pairedBitBox.ethSignTransaction(chainId, derivationPath, rlpPayload)
    throw new Error('BitBox02 signEthTransaction: awaiting bitbox-api WASM integration');
  }

  async signMessage(
    _chainId: number,
    _derivationPath: string,
    _message: Uint8Array,
  ): Promise<Uint8Array> {
    this.ensureConnected();
    // TODO: pairedBitBox.ethSignMessage(derivationPath, message)
    throw new Error('BitBox02 signMessage: awaiting bitbox-api WASM integration');
  }

  getConnectedDevice(): HardwareWalletDevice | null {
    return this.connectedDevice;
  }

  isConnected(): boolean {
    return this.transport !== null;
  }

  private ensureConnected(): void {
    if (!this.transport) {
      throw new Error('BitBox02 not connected. Call connect() first.');
    }
  }
}
