import type {
  HardwareWalletDevice,
  HardwareWalletProvider,
} from './types';

/**
 * BitBox02 hardware wallet integration.
 *
 * SDK options (from research):
 * - `bitbox-api` (npm, v0.12.0, WASM, active) — preferred over legacy `bitbox02-api`
 *   GitHub: BitBoxSwiss/bitbox-api-rs
 *   Features: BTC (xPub, SegWit, Taproot, PSBT), ETH (EIP-1559, ERC-20, EIP-712)
 *
 * TRANSPORT PROBLEM: Both official SDKs only support WebHID (browser) or
 * BitBoxBridge (desktop daemon). Neither works in React Native.
 *
 * Viable approaches for React Native:
 *   A) Native Android HID Module (like @ledgerhq/react-native-hid) — Android only
 *      The Rust library has a clean ReadWrite trait; only transport needs replacing.
 *   B) BLE via react-native-ble-plx — requires BitBox02 Nova (BLE model), Android+iOS
 *   C) WalletConnect — use BitBox desktop app as signer, low effort, both platforms
 *
 * iOS LIMITATION: Apple blocks USB-HID access for third-party apps.
 * Direct USB is impossible on iOS. BLE (Nova) or WalletConnect are the only options.
 *
 * Reference implementation: RealUnit app
 *   - Connection: lib/screens/hardware_connect_bitbox/bloc/connect_bitbox_cubit.dart
 *   - Credentials: lib/packages/hardware_wallet/bitbox_credentials.dart
 *   - Service: lib/packages/hardware_wallet/bitbox.dart
 *
 * Connection flow (from RealUnit):
 *   1. Poll USB devices every 500ms
 *   2. connect(device)
 *   3. initBitBox()
 *   4. channelHashVerify() — secure channel verification
 *   5. getETHAddress() — retrieve address from device
 *   6. Create view-only wallet (no seed stored locally)
 *
 * Signing flow:
 *   - EVM transactions: signETHRLPTransaction(chainId, path, payload, isEIP1559)
 *   - Messages: signETHMessage(chainId, path, payload)
 *   - Note: EIP-712 typed signing is NOT supported on BitBox02
 */
export class BitboxProvider implements HardwareWalletProvider {
  async scanDevices(): Promise<HardwareWalletDevice[]> {
    // TODO: Implement USB device scanning
    throw new Error('BitBox02 integration not yet implemented');
  }

  async connect(_device: HardwareWalletDevice): Promise<void> {
    // TODO: connect → initBitBox → channelHashVerify
    throw new Error('BitBox02 integration not yet implemented');
  }

  async disconnect(): Promise<void> {
    // TODO: Cleanup connection
    throw new Error('BitBox02 integration not yet implemented');
  }

  async getEthAddress(_derivationPath?: string): Promise<string> {
    // TODO: getETHAddress from BitBox device
    throw new Error('BitBox02 integration not yet implemented');
  }

  async getBtcAddress(_derivationPath?: string): Promise<string> {
    // TODO: getBTCAddress from BitBox device
    throw new Error('BitBox02 integration not yet implemented');
  }

  async signEthTransaction(
    _chainId: number,
    _derivationPath: string,
    _rlpPayload: Uint8Array,
    _isEIP1559: boolean,
  ): Promise<{ r: string; s: string; v: number }> {
    // TODO: signETHRLPTransaction → extract r,s,v from 65-byte signature
    throw new Error('BitBox02 integration not yet implemented');
  }

  async signMessage(
    _chainId: number,
    _derivationPath: string,
    _message: Uint8Array,
  ): Promise<Uint8Array> {
    // TODO: signETHMessage
    throw new Error('BitBox02 integration not yet implemented');
  }
}
