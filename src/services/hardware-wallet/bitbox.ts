import { Platform } from 'react-native';
import type {
  BitboxTransport,
  HardwareWalletDevice,
  HardwareWalletProvider,
} from './types';
import { scanUsbDevices } from './transport-usb';
import { scanBleDevices } from './transport-ble';

/**
 * BitBox02 hardware wallet provider.
 *
 * Dual-transport architecture:
 *   - USB HID: Standard BitBox02, Android only
 *   - BLE: BitBox02 Nova, Android + iOS
 *
 * Both transports share the same protocol stack:
 *   Raw bytes (USB/BLE) → Noise XX handshake → Encrypted channel → Protobuf → API
 *
 * SDK: `bitbox-api` (npm, v0.12.0, WASM from BitBoxSwiss/bitbox-api-rs)
 *   - The WASM core handles Noise handshake, Protobuf encoding, signing logic
 *   - Only the transport layer (ReadWrite trait) needs native implementation
 *   - Features: BTC (SegWit, Taproot, PSBT), ETH (EIP-1559, ERC-20, EIP-712)
 *
 * Reference: RealUnit app
 *   - Connection: lib/screens/hardware_connect_bitbox/bloc/connect_bitbox_cubit.dart
 *   - Credentials: lib/packages/hardware_wallet/bitbox_credentials.dart
 *   - Service: lib/packages/hardware_wallet/bitbox.dart
 */
export class BitboxProvider implements HardwareWalletProvider {
  private transport: BitboxTransport | null = null;

  /**
   * Scan for BitBox02 devices via both USB (Android) and BLE (Android + iOS).
   * Returns all found devices with their transport type.
   */
  async scanDevices(): Promise<HardwareWalletDevice[]> {
    const [usbDevices, bleDevices] = await Promise.all([
      scanUsbDevices(),
      scanBleDevices(),
    ]);

    return [...usbDevices, ...bleDevices];
  }

  /**
   * Connect to a BitBox02 device.
   * Automatically selects USB or BLE transport based on the device.
   */
  async connect(device: HardwareWalletDevice): Promise<void> {
    if (device.transport === 'usb' && Platform.OS !== 'android') {
      throw new Error('USB connection is only available on Android');
    }

    // TODO:
    // 1. Create transport (UsbTransport or BleTransport)
    // 2. Initialize bitbox-api WASM core with transport
    // 3. Perform Noise XX handshake (channel pairing)
    // 4. channelHashVerify() — user confirms hash on device
    // 5. Store transport reference
    throw new Error('BitBox02 connect not yet implemented');
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  async getEthAddress(_derivationPath?: string): Promise<string> {
    this.ensureConnected();
    // TODO: bitboxApi.ethGetAddress(derivationPath)
    throw new Error('BitBox02 getEthAddress not yet implemented');
  }

  async getBtcAddress(_derivationPath?: string): Promise<string> {
    this.ensureConnected();
    // TODO: bitboxApi.btcGetAddress(derivationPath)
    throw new Error('BitBox02 getBtcAddress not yet implemented');
  }

  async signEthTransaction(
    _chainId: number,
    _derivationPath: string,
    _rlpPayload: Uint8Array,
    _isEIP1559: boolean,
  ): Promise<{ r: string; s: string; v: number }> {
    this.ensureConnected();
    // TODO: bitboxApi.ethSignTransaction(chainId, derivationPath, rlpPayload, isEIP1559)
    // Extract r, s, v from 65-byte signature response
    throw new Error('BitBox02 signEthTransaction not yet implemented');
  }

  async signMessage(
    _chainId: number,
    _derivationPath: string,
    _message: Uint8Array,
  ): Promise<Uint8Array> {
    this.ensureConnected();
    // TODO: bitboxApi.ethSignMessage(chainId, derivationPath, message)
    throw new Error('BitBox02 signMessage not yet implemented');
  }

  private ensureConnected(): void {
    if (!this.transport) {
      throw new Error('BitBox02 not connected. Call connect() first.');
    }
  }
}
