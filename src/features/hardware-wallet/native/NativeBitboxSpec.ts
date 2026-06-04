/**
 * NativeBitboxSpec — the contract the native module (iOS Swift / Android Kotlin)
 * must implement. It mirrors the gomobile-exported API of BitBoxSwiss/bitbox02-api-go
 * (see RealUnit's `bitbox_flutter/go/api/*.go`). The native side owns the device I/O
 * (USB-HID / BLE) and the Go protocol session; this TS spec is the JS-facing surface.
 *
 * Reused binaries (already built by RealUnit, no rebuild needed for the spike):
 *   iOS:     bitbox_flutter/ios/Api.xcframework        (arm64 + simulator)
 *   Android: bitbox_flutter/android/libs/api.aar       (gomobile bind output)
 *
 * Each handle returned by `connect` identifies one paired session.
 */
export interface NativeBitboxSpec {
  /** Begin a session over an already-opened transport (deviceId from scanDevices). Returns a session handle. */
  connect(deviceId: string): Promise<string>;
  /** Run the noise pairing/init handshake. */
  init(handle: string): Promise<boolean>;
  /** Pairing channel hash to show the user for out-of-band comparison. */
  channelHash(handle: string): Promise<string>;
  /** Confirm (true) / reject (false) the channel hash. */
  channelHashVerify(handle: string, ok: boolean): Promise<void>;

  deviceInfo(handle: string): Promise<{ name: string; initialized: boolean; version: string }>;
  product(handle: string): Promise<string>;

  // ETH — maps 1:1 to ETHGetAddress / ETHSignEIP1559 / ETHSignMessage / ETHSignTypedMessage
  ethAddress(handle: string, chainId: number, keypath: string, display: boolean): Promise<string>;
  ethXpub(handle: string, keypath: string): Promise<string>;
  /** Returns 65-byte signature (r||s||v) as hex; JS splits into {r,s,v}. */
  ethSign1559(handle: string, keypath: string, txJson: string): Promise<string>;
  ethSignMessage(handle: string, chainId: number, keypath: string, msgHex: string): Promise<string>;
  ethSignTypedMessage(handle: string, chainId: number, keypath: string, typedJson: string): Promise<string>;

  // BTC
  btcAddress(handle: string, coin: string, keypath: string, simpleType: string, display: boolean): Promise<string>;
  btcXpub(handle: string, coin: string, keypath: string, xpubType: string, display: boolean): Promise<string>;
  btcSignPSBT(handle: string, coin: string, psbt: string): Promise<string>;

  close(handle: string): Promise<void>;
}
