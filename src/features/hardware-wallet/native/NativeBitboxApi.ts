import type { BitboxApi } from '../services/bitbox-protocol';
import type { NativeBitboxSpec } from './NativeBitboxSpec';

/** 65-byte (r||s||v) hex → the {r,s,v} shape the rest of the app expects. */
function splitSig(hex: string): { r: Uint8Array; s: Uint8Array; v: Uint8Array } {
  const b = Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex'));
  if (b.length < 65) throw new Error(`bitbox: short signature (${b.length} bytes)`);
  return { r: b.slice(0, 32), s: b.slice(32, 64), v: b.slice(64) };
}

/**
 * NativeBitboxApi — a drop-in `BitboxApi` backed by the native gomobile module
 * instead of the `bitbox-api` WASM lib in a WebView. This is the seam swap: the
 * existing HardwareWalletProvider keeps working unchanged; only the protocol
 * implementation moves from WASM/WebView to native.
 *
 * SPIKE STATUS: structure complete; the iOS Swift / Android Kotlin bindings that
 * back `NativeBitboxSpec` are the remaining work (needs a full-Xcode machine —
 * see docs/bitbox-native-spike/SPIKE.md). The Go core this wraps is verified
 * (see go-core-proof.txt).
 */
export class NativeBitboxApi implements BitboxApi {
  constructor(
    private readonly native: NativeBitboxSpec,
    private readonly handle: string,
  ) {}

  deviceInfo() {
    return this.native.deviceInfo(this.handle);
  }

  product() {
    // product() is sync in BitboxApi; the native impl caches it at connect()
    throw new Error('NativeBitboxApi.product(): wire to cached value from connect()');
  }

  async ethAddress(chainId: bigint, keypath: string, display: boolean) {
    return this.native.ethAddress(this.handle, Number(chainId), keypath, display);
  }

  ethXpub(keypath: string) {
    return this.native.ethXpub(this.handle, keypath);
  }

  async ethSign1559Transaction(keypath: string, tx: Parameters<BitboxApi['ethSign1559Transaction']>[1]) {
    const toHex = (u: Uint8Array) => Buffer.from(u).toString('hex');
    const txJson = JSON.stringify({
      chainId: tx.chainId,
      nonce: toHex(tx.nonce),
      maxPriorityFeePerGas: toHex(tx.maxPriorityFeePerGas),
      maxFeePerGas: toHex(tx.maxFeePerGas),
      gasLimit: toHex(tx.gasLimit),
      recipient: toHex(tx.recipient),
      value: toHex(tx.value),
      data: toHex(tx.data),
    });
    return splitSig(await this.native.ethSign1559(this.handle, keypath, txJson));
  }

  async ethSignMessage(chainId: bigint, keypath: string, msg: Uint8Array) {
    const hex = Buffer.from(msg).toString('hex');
    return splitSig(await this.native.ethSignMessage(this.handle, Number(chainId), keypath, hex));
  }

  async ethSignTypedMessage(chainId: bigint, keypath: string, msg: unknown) {
    const json = JSON.stringify(msg);
    return splitSig(await this.native.ethSignTypedMessage(this.handle, Number(chainId), keypath, json));
  }

  async btcAddress(
    coin: 'btc' | 'tbtc',
    keypath: string,
    scriptConfig: { simpleType: 'p2wpkh' | 'p2tr' | 'p2wpkhP2sh' },
    display: boolean,
  ) {
    return this.native.btcAddress(this.handle, coin, keypath, scriptConfig.simpleType, display);
  }

  btcXpub(coin: 'btc' | 'tbtc', keypath: string, xpubType: 'zpub' | 'xpub' | 'tpub', display: boolean) {
    return this.native.btcXpub(this.handle, coin, keypath, xpubType, display);
  }

  btcSignPSBT(coin: 'btc' | 'tbtc', psbt: string) {
    return this.native.btcSignPSBT(this.handle, coin, psbt);
  }

  close() {
    void this.native.close(this.handle);
  }
}
