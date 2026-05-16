// audit-skip-file: this file is the SDK boundary — it declares the
// ethSign* interface that delegates to bitbox-api WASM. Antiklepto is
// enforced inside the WASM library; the audit-runner's A3 check is for
// consumer code that builds its own sign loop bypassing the SDK.

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
 * Convert EthSignature (Uint8Array r, s, v) to a hex-string + number form.
 *
 * v is decoded as a big-endian integer over the ENTIRE byte sequence.
 *
 * The previous implementation returned `sig.v[0]!` — silently dropping every
 * byte past the first. That was only safe for EIP-155 chainIds ≤ 110 (where
 * `v = 2*chainId + 35 + parity` stays ≤ 255). For Polygon (chainId 137,
 * v ∈ {309, 310}), Arbitrum, Optimism, BSC, and every other production L2,
 * v overflows one byte and the truncation produced an unbroadcastable
 * signature — or, worse, a signature whose recovered chainId silently
 * pointed at mainnet.
 *
 * We return v as `number`. JavaScript can losslessly represent any v we
 * could realistically see (chainId up to 2^52). Throws if a value larger
 * than Number.MAX_SAFE_INTEGER is encountered.
 */
export function ethSignatureToHex(sig: { r: Uint8Array; s: Uint8Array; v: Uint8Array }): {
  r: string;
  s: string;
  v: number;
} {
  if (!(sig.r instanceof Uint8Array) || sig.r.length !== 32) {
    throw new Error('ethSignatureToHex: r must be a 32-byte Uint8Array');
  }
  if (!(sig.s instanceof Uint8Array) || sig.s.length !== 32) {
    throw new Error('ethSignatureToHex: s must be a 32-byte Uint8Array');
  }
  if (!(sig.v instanceof Uint8Array) || sig.v.length === 0) {
    throw new Error('ethSignatureToHex: v must be a non-empty Uint8Array');
  }
  return {
    r: '0x' + bytesToHex(sig.r),
    s: '0x' + bytesToHex(sig.s),
    v: bigEndianToNumber(sig.v, 'v'),
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bigEndianToNumber(bytes: Uint8Array, label: string): number {
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (n > (Number.MAX_SAFE_INTEGER - b) / 256) {
      throw new Error(`${label} exceeds Number.MAX_SAFE_INTEGER`);
    }
    n = n * 256 + b;
  }
  return n;
}
