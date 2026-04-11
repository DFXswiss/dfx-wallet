import { Platform } from 'react-native';
import type { BitboxTransport, HardwareWalletDevice, HardwareWalletProvider } from './types';
import { scanUsbDevices, UsbTransport } from './transport-usb';
import { BleTransport, scanBleDevices } from './transport-ble';
import { WasmBridge } from './wasm-bridge';
import { ethSignatureToHex } from './bitbox-protocol';

/**
 * BitBox02 hardware wallet provider.
 *
 * Dual-transport + WASM architecture:
 *   USB/BLE Transport ←→ WasmBridge (postMessage) ←→ WebView (bitbox-api WASM)
 *
 * The WasmBridge handles the Noise XX handshake, Protobuf encoding,
 * and all signing operations inside the WebView's WASM runtime.
 * Transport read/write calls are bridged back to native USB/BLE.
 */
export class BitboxProvider implements HardwareWalletProvider {
  private transport: BitboxTransport | null = null;
  private connectedDevice: HardwareWalletDevice | null = null;
  private bridge: WasmBridge;

  constructor() {
    this.bridge = new WasmBridge();
  }

  /** Get the WasmBridge instance (needed by BitboxWasmWebView component) */
  getBridge(): WasmBridge {
    return this.bridge;
  }

  async scanDevices(): Promise<HardwareWalletDevice[]> {
    const results = await Promise.allSettled([scanUsbDevices(), scanBleDevices()]);
    const devices: HardwareWalletDevice[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') devices.push(...result.value);
    }
    return devices;
  }

  async connect(device: HardwareWalletDevice): Promise<void> {
    if (device.transport === 'usb' && Platform.OS !== 'android') {
      throw new Error('USB connection is only available on Android');
    }

    await this.disconnect();

    // 1. Open physical transport
    if (device.transport === 'usb') {
      const usb = new UsbTransport();
      await usb.open(device.id);
      this.transport = usb;
    } else {
      const ble = new BleTransport();
      await ble.connectToDevice(device.id);
      this.transport = ble;
    }

    // 2. Wire transport to WASM bridge
    this.bridge.onTransportWrite = async (data: Uint8Array) => {
      if (this.transport) await this.transport.write(data);
    };
    this.bridge.onTransportRead = async () => {
      if (this.transport) {
        const data = await this.transport.read();
        this.bridge.sendTransportData(data);
      }
    };

    // 3. Initiate pairing via WASM
    await this.bridge.call('pair');

    this.connectedDevice = device;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.bridge.call('close');
      } catch {
        // Ignore close errors
      }
      await this.transport.close();
      this.transport = null;
    }
    this.connectedDevice = null;
  }

  async getEthAddress(derivationPath?: string): Promise<string> {
    this.ensureConnected();
    return this.bridge.call<string>('ethAddress', [
      1, // chainId (mainnet)
      derivationPath ?? "m/44'/60'/0'/0/0",
      false, // don't display on device
    ]);
  }

  async getBtcAddress(derivationPath?: string): Promise<string> {
    this.ensureConnected();
    return this.bridge.call<string>('btcAddress', [
      'btc',
      derivationPath ?? "m/84'/0'/0'/0/0",
      { simpleType: 'p2wpkh' },
      false,
    ]);
  }

  async signEthTransaction(
    chainId: number,
    derivationPath: string,
    rlpPayload: Uint8Array,
    _isEIP1559: boolean,
  ): Promise<{ r: string; s: string; v: number }> {
    this.ensureConnected();
    const sig = await this.bridge.call<{ r: number[]; s: number[]; v: number[] }>(
      'ethSign1559Transaction',
      [derivationPath, rlpPayload, undefined],
    );
    return ethSignatureToHex({
      r: new Uint8Array(sig.r),
      s: new Uint8Array(sig.s),
      v: new Uint8Array(sig.v),
    });
  }

  async signMessage(
    chainId: number,
    derivationPath: string,
    message: Uint8Array,
  ): Promise<Uint8Array> {
    this.ensureConnected();
    const sig = await this.bridge.call<{ r: number[]; s: number[]; v: number[] }>(
      'ethSignMessage',
      [chainId, derivationPath, Array.from(message)],
    );
    // Combine r + s + v into 65-byte signature
    const result = new Uint8Array(65);
    result.set(new Uint8Array(sig.r), 0);
    result.set(new Uint8Array(sig.s), 32);
    result.set(new Uint8Array(sig.v), 64);
    return result;
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
