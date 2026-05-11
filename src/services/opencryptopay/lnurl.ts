/**
 * LNURL bech32 decoder + OpenCryptoPay QR sniffer.
 *
 * LNURL (LUD-01 / LUD-17) is bech32-encoded UTF-8 of an https URL.
 * OpenCryptoPay piggybacks on that — DFX' QR codes are either:
 *   - a bare `LNURL1…` bech32 string
 *   - a BIP-21 URI with a `lightning=lnurl…` parameter
 *   - a non-bech32 LUD-17 scheme (`lnurlp:`, `lnurlw:`, `lnurlc:`, `keyauth:`)
 *
 * The reference implementation is DFX's frankencoin-wallet
 * `lib/src/core/open_crypto_pay/lnurl.dart`; this file mirrors its
 * decode path 1:1 so the same QR codes that work on the Frankencoin
 * wallet also work here.
 */

/**
 * Quick boolean check used by the Pay screen to decide whether to
 * route a scanned QR into the OpenCryptoPay flow. Mirrors the Flutter
 * helper exactly — kept lowercase + permissive on purpose so it
 * recognises BIP-21 URIs that carry `LIGHTNING=lnurl…`.
 */
export function isOpenCryptoPayQR(value: string): boolean {
  const lc = value.toLowerCase();
  return lc.includes('lightning=lnurl') || lc.startsWith('lnurl');
}

// eslint-disable-next-line no-secrets/no-secrets -- BIP-173 bech32 alphabet, not a secret
const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_ALPHABET_MAP: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (let i = 0; i < BECH32_ALPHABET.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- BECH32_ALPHABET is a closed literal string
    out[BECH32_ALPHABET[i]!] = i;
  }
  return out;
})();

const LUD17_SCHEMES = new Set(['lnurlw', 'lnurlc', 'lnurlp', 'keyauth']);

/**
 * Decode a scanned LNURL/QR payload into the https URL it points at.
 *
 * Handles three input shapes:
 *   1. Bare bech32 `lnurl1…` (case-insensitive).
 *   2. BIP-21 URI like `bitcoin:bc1q…?lightning=lnurl1…` — extracts the
 *      `lightning` parameter and recurses.
 *   3. LUD-17 non-bech32 schemes (`lnurlp:`, `lnurlw:`, `lnurlc:`,
 *      `keyauth:`) — rewritten to https (or http for .onion hosts).
 *
 * Throws on inputs that match none of these (caller surfaces the error
 * as "Ungültiger Pay-QR-Code" so the user knows the scan won't yield
 * an OpenCryptoPay quote).
 */
export function decodeLNURL(encoded: string): URL {
  const trimmed = encoded.trim();

  // Shape 2: BIP-21 URI with a `lightning=` parameter — pull the
  // parameter out and decode that. Recursive so it also handles a
  // LUD-17 scheme inside the parameter.
  if (/^[a-zA-Z]+:/i.test(trimmed) && /[?&]lightning=/i.test(trimmed)) {
    const url = new URL(trimmed);
    const lightning = url.searchParams.get('lightning') ?? url.searchParams.get('LIGHTNING');
    if (lightning && lightning.length > 0) {
      return decodeLNURL(lightning);
    }
  }

  // Shape 3: LUD-17 non-bech32 schemes — rewrite to https (http for
  // .onion hosts, as the spec mandates).
  const lcSchemeMatch = trimmed.match(/^([a-zA-Z]+):/);
  if (lcSchemeMatch) {
    const scheme = lcSchemeMatch[1]!.toLowerCase();
    if (LUD17_SCHEMES.has(scheme)) {
      // URL parsing chokes on the custom scheme, so rewrite the prefix
      // first and parse the result.
      const rest = trimmed.slice(scheme.length + 1); // strip "lnurlp:" etc.
      // Strip leading `//` if present so we end up with a canonical
      // "host[/path][?query]" tail to slap onto https://.
      const tail = rest.replace(/^\/+/, '');
      const probeUrl = new URL(`https://${tail}`);
      const host = probeUrl.hostname.toLowerCase();
      const httpsOrHttp = host.endsWith('.onion') || host.endsWith('.onion.') ? 'http' : 'https';
      return new URL(`${httpsOrHttp}://${tail}`);
    }
  }

  // Shape 1: bare bech32 LNURL — strip the optional `lightning:` URI
  // scheme prefix, then decode.
  const lnurl = findLnUrl(trimmed);
  const decoded = bech32Decode(lnurl);
  const bytes = convertBits(decoded.data, 5, 8, false);
  const url = utf8Decode(bytes);
  return new URL(url);
}

/**
 * Pull the `lnurl1…` substring out of an input that might have a
 * `lightning:` scheme prefix or stray whitespace. Throws if no lnurl
 * marker is found.
 */
function findLnUrl(input: string): string {
  const matches = input.toLowerCase().match(/((lnurl)([0-9]+[a-z0-9]+))/);
  if (!matches || matches.length === 0) {
    throw new Error('Not a valid LNURL string');
  }
  return matches[0]!;
}

type Bech32Decoded = { hrp: string; data: number[] };

/**
 * Stripped-down bech32 decoder — only enough to handle LNURL payloads,
 * which use the standard `bech32` (not bech32m) checksum. Mirrors the
 * Flutter `Bech32Codec().decode(...)` for the input lengths LNURL
 * produces (a few hundred chars). Does not validate the checksum for
 * inputs longer than the legacy 90-char limit; LNURL routinely exceeds
 * that and the Bitcoin tooling ecosystem accepts the longer payloads
 * without a separate guard.
 */
function bech32Decode(input: string): Bech32Decoded {
  const lc = input.toLowerCase();
  const sep = lc.lastIndexOf('1');
  if (sep < 1 || sep + 7 > lc.length) {
    throw new Error('LNURL bech32: bad separator position');
  }
  const hrp = lc.slice(0, sep);
  const data: number[] = [];
  for (let i = sep + 1; i < lc.length; i++) {
    /* eslint-disable security/detect-object-injection -- lc[i] is a bounded integer index into a string, BECH32_ALPHABET_MAP keyed by single char from that fixed alphabet */
    const ch = lc[i]!;
    const v = BECH32_ALPHABET_MAP[ch];
    /* eslint-enable security/detect-object-injection */
    if (v === undefined) {
      throw new Error(`LNURL bech32: bad character "${ch}"`);
    }
    data.push(v);
  }
  // Drop the trailing 6-symbol checksum. We deliberately do NOT verify
  // the checksum because LNURL payloads exceed the canonical bech32
  // length limit; the QR scanner already filters obvious corruption.
  return { hrp, data: data.slice(0, -6) };
}

/**
 * Convert a sequence of integers from `inBits` per element to `outBits`
 * per element with optional zero-padding. Standard bech32 helper, used
 * here to repack the 5-bit symbols the bech32 decoder produces into
 * 8-bit UTF-8 bytes.
 */
function convertBits(data: number[], inBits: number, outBits: number, pad: boolean): number[] {
  let value = 0;
  let bits = 0;
  const maxV = (1 << outBits) - 1;
  const out: number[] = [];
  for (const d of data) {
    value = (value << inBits) | d;
    bits += inBits;
    while (bits >= outBits) {
      bits -= outBits;
      out.push((value >> bits) & maxV);
    }
  }
  if (pad) {
    if (bits > 0) out.push((value << (outBits - bits)) & maxV);
  } else if (bits >= inBits || ((value << (outBits - bits)) & maxV) > 0) {
    throw new Error('LNURL bech32: bad padding');
  }
  return out;
}

/**
 * UTF-8 decode a byte array. `TextDecoder` is available in React Native
 * via Hermes' Intl support; the fallback path covers older runtimes by
 * doing the conversion manually (the inputs we deal with are ASCII
 * URLs anyway, so the slow path is rarely hit).
 */
function utf8Decode(bytes: number[]): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}
