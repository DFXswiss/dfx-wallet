/**
 * BitBox02 protocol layer.
 *
 * Maps the bitbox-api WASM SDK types (PairedBitBox, PairingBitBox)
 * to our HardwareWalletProvider interface.
 *
 * The bitbox-api WASM cannot run directly in React Native's JS engine
 * (Hermes/JSC don't support WASM natively). Two viable approaches:
 *
 * A) Hidden WebView: Load WASM in an invisible WebView, bridge calls
 *    via postMessage. WebView engines (WKWebView/Chrome) support WASM.
 *    Pros: Works on both platforms, uses bitbox-api as-is.
 *    Cons: Async overhead, message serialization.
 *
 * B) Rust FFI via JSI: Compile bitbox-api-rs directly into a native
 *    module using uniffi or jsi-rs.
 *    Pros: Native performance, no serialization.
 *    Cons: High build complexity, platform-specific compilation.
 *
 * For now, this file defines the type-safe interface that either
 * approach would implement. The WebView approach is recommended
 * for initial implementation due to lower complexity.
 */

// Re-export types from bitbox-api for use in our codebase
export type {
  BtcCoin,
  BtcScriptConfig,
  BtcSimpleType,
  DeviceInfo,
  Eth1559Transaction,
  EthSignature,
  EthTransaction,
  Keypath,
  Product,
  XPubType,
} from 'bitbox-api';

/** Our abstraction over the PairedBitBox WASM class */
export interface BitboxApi {
  /** Get device info (name, version, etc.) */
  deviceInfo(): Promise<{
    name: string;
    initialized: boolean;
    version: string;
  }>;

  /** Get product type */
  product():
    | 'bitbox02-multi'
    | 'bitbox02-btconly'
    | 'bitbox02-nova-multi'
    | 'bitbox02-nova-btconly'
    | 'unknown';

  /** Get ETH address */
  ethAddress(chainId: bigint, keypath: string, display: boolean): Promise<string>;

  /** Get ETH xpub */
  ethXpub(keypath: string): Promise<string>;

  /** Sign ETH EIP-1559 transaction */
  ethSign1559Transaction(
    keypath: string,
    tx: {
      chainId: number;
      nonce: Uint8Array;
      maxPriorityFeePerGas: Uint8Array;
      maxFeePerGas: Uint8Array;
      gasLimit: Uint8Array;
      recipient: Uint8Array;
      value: Uint8Array;
      data: Uint8Array;
    },
  ): Promise<{ r: Uint8Array; s: Uint8Array; v: Uint8Array }>;

  /** Sign ETH personal message */
  ethSignMessage(
    chainId: bigint,
    keypath: string,
    msg: Uint8Array,
  ): Promise<{ r: Uint8Array; s: Uint8Array; v: Uint8Array }>;

  /** Sign ETH EIP-712 typed data */
  ethSignTypedMessage(
    chainId: bigint,
    keypath: string,
    msg: unknown,
  ): Promise<{ r: Uint8Array; s: Uint8Array; v: Uint8Array }>;

  /** Get BTC address */
  btcAddress(
    coin: 'btc' | 'tbtc',
    keypath: string,
    scriptConfig: { simpleType: 'p2wpkh' | 'p2tr' | 'p2wpkhP2sh' },
    display: boolean,
  ): Promise<string>;

  /** Get BTC xpub */
  btcXpub(
    coin: 'btc' | 'tbtc',
    keypath: string,
    xpubType: 'zpub' | 'xpub' | 'tpub',
    display: boolean,
  ): Promise<string>;

  /** Sign a PSBT */
  btcSignPSBT(coin: 'btc' | 'tbtc', psbt: string): Promise<string>;

  /** Close connection */
  close(): void;
}

/**
 * Convert EthSignature (Uint8Array r,s,v) to hex string format.
 */
export function ethSignatureToHex(sig: { r: Uint8Array; s: Uint8Array; v: Uint8Array }): {
  r: string;
  s: string;
  v: number;
} {
  return {
    r: '0x' + bytesToHex(sig.r),
    s: '0x' + bytesToHex(sig.s),
    // v is the 1-byte recovery id (0x1b/0x1c); always exactly one element.
    v: sig.v[0]!,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
