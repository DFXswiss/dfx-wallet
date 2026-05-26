import { decodeLNURL } from './lnurl';

/**
 * OpenCryptoPay HTTP client.
 *
 * Wire-format mirrors DFX' `frankencoin-wallet`
 * `lib/src/core/open_crypto_pay/open_crypto_pay_service.dart`:
 *
 *   1. Scan a QR → `decodeLNURL(value)` yields the lnurlp callback URL.
 *   2. `fetchQuote(url)` → GET that URL, response carries
 *      `{ callback, transferAmounts, quote, displayName }`.
 *   3. User picks an `asset` + `method` (blockchain) from the
 *      `transferAmounts` matrix.
 *   4. `getPaymentTarget(callback, quote, asset, method)` → GET the
 *      callback with the choices, response carries an ERC-681 URI
 *      identifying the wallet address + amount to transfer.
 *   5. Wallet signs + broadcasts the TX, then `commitTx(callback, …)`
 *      tells the OCP provider the on-chain txid so it can credit the
 *      merchant.
 *
 * Errors are surfaced as typed `OpenCryptoPayError` instances with a
 * `code` field — the UI surfaces a different message per kind so the
 * user understands whether the quote expired, the asset isn't
 * supported, or the network just dropped.
 */

export type OpenCryptoPayErrorCode =
  | 'invalid-qr'
  | 'fetch-failed'
  | 'invalid-response'
  | 'expired'
  | 'cancelled'
  | 'commit-failed';

export class OpenCryptoPayError extends Error {
  constructor(
    public readonly code: OpenCryptoPayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OpenCryptoPayError';
  }
}

export type TransferAmountAsset = {
  /** Token symbol as the OCP provider reports it (e.g. "ZCHF", "USDC"). */
  asset: string;
  /** Decimal amount string — the OCP provider has already converted
   *  from fiat to the asset's denomination. */
  amount: string;
};

export type TransferAmount = {
  /** Chain identifier as the OCP provider reports it
   *  ("Ethereum" / "Polygon" / "Arbitrum" / "Optimism" / "Base" / "Bitcoin" / "Lightning"). */
  method: string;
  /** Minimum on-chain fee the OCP provider expects (in the asset's
   *  smallest unit). Used by the UI to warn the user when their
   *  available native balance is below this threshold. */
  minFee: number;
  assets: TransferAmountAsset[];
};

export type OpenCryptoPayQuote = {
  /** Unique quote id — feed back into `getPaymentTarget` + `commitTx`
   *  so the OCP provider can correlate the calls to a single payment. */
  id: string;
  /** UNIX millisecond timestamp at which this quote stops being
   *  honoured by the merchant — UI shows a countdown / "expired" badge. */
  expiresAt: number;
};

export type OpenCryptoPayInvoice = {
  /** Human-readable merchant / payee name from the LNURL payload. */
  displayName: string;
  callbackUrl: string;
  quote: OpenCryptoPayQuote;
  transferAmounts: TransferAmount[];
};

export type OpenCryptoPayTarget = {
  /** ERC-681 URI as returned by the OCP provider — caller parses out
   *  the recipient address + amount, signs+broadcasts a transfer. */
  paymentUri: string;
  /** Optional UNIX ms expiry for the *target address* (some providers
   *  rotate the address per quote so the merchant can't reuse it). */
  expiresAt: number | null;
};

/**
 * Parse a scanned QR string into a decoded LNURL endpoint, throwing a
 * typed error when the value isn't actually an LNURL payload.
 */
export function lnurlToEndpoint(rawQr: string): URL {
  try {
    return decodeLNURL(rawQr);
  } catch (err) {
    throw new OpenCryptoPayError(
      'invalid-qr',
      err instanceof Error ? err.message : 'Could not decode LNURL',
    );
  }
}

type RawTransferAmountAsset = { asset?: unknown; amount?: unknown };
type RawTransferAmount = { method?: unknown; minFee?: unknown; assets?: unknown };
type RawQuote = {
  callback?: unknown;
  transferAmounts?: unknown;
  displayName?: unknown;
  quote?: { id?: unknown; expiration?: unknown };
};

/**
 * GET the LNURL endpoint and parse the OpenCryptoPay quote payload.
 * Both the bare bech32 LNURL and a BIP-21 URI are accepted on the QR
 * side — the caller fed `decodeLNURL` already.
 */
export async function fetchQuote(
  endpoint: URL,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<OpenCryptoPayInvoice> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(endpoint.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  } catch (err) {
    throw new OpenCryptoPayError(
      'fetch-failed',
      err instanceof Error ? err.message : 'Network error',
    );
  }
  if (!res.ok) {
    throw new OpenCryptoPayError('fetch-failed', `HTTP ${res.status}`);
  }
  let body: RawQuote;
  try {
    body = (await res.json()) as RawQuote;
  } catch (err) {
    throw new OpenCryptoPayError(
      'invalid-response',
      err instanceof Error ? err.message : 'Non-JSON response',
    );
  }
  const callback = body.callback;
  const transferAmountsRaw = body.transferAmounts;
  const quoteObj = body.quote;
  if (
    typeof callback !== 'string' ||
    !Array.isArray(transferAmountsRaw) ||
    !quoteObj ||
    typeof quoteObj.id !== 'string'
  ) {
    throw new OpenCryptoPayError('invalid-response', 'Missing callback / transferAmounts / quote');
  }

  const expiresAt = parseExpiration(quoteObj.expiration);
  const transferAmounts: TransferAmount[] = [];
  for (const raw of transferAmountsRaw as RawTransferAmount[]) {
    if (!raw || typeof raw.method !== 'string' || !Array.isArray(raw.assets)) continue;
    const assets: TransferAmountAsset[] = [];
    for (const a of raw.assets as RawTransferAmountAsset[]) {
      if (!a) continue;
      if (typeof a.asset !== 'string' || typeof a.amount !== 'string') continue;
      assets.push({ asset: a.asset, amount: a.amount });
    }
    if (assets.length === 0) continue;
    const minFee = typeof raw.minFee === 'number' ? raw.minFee : 0;
    transferAmounts.push({ method: raw.method, minFee, assets });
  }
  if (transferAmounts.length === 0) {
    throw new OpenCryptoPayError('invalid-response', 'No transfer options offered');
  }

  return {
    displayName: typeof body.displayName === 'string' ? body.displayName : '',
    callbackUrl: callback,
    quote: { id: quoteObj.id, expiresAt },
    transferAmounts,
  };
}

/**
 * Tell the OpenCryptoPay provider which asset/chain the user picked
 * and receive the payment target (ERC-681 URI). The provider may rotate
 * the address per quote, so the caller MUST use the returned URI
 * instead of caching a single recipient address.
 */
export async function getPaymentTarget(
  callbackUrl: string,
  quoteId: string,
  asset: string,
  method: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<OpenCryptoPayTarget> {
  const url = new URL(callbackUrl);
  url.searchParams.set('quote', quoteId);
  url.searchParams.set('asset', asset);
  url.searchParams.set('method', method);
  const fetchImpl = options?.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  } catch (err) {
    throw new OpenCryptoPayError(
      'fetch-failed',
      err instanceof Error ? err.message : 'Network error',
    );
  }
  if (!res.ok) {
    throw new OpenCryptoPayError('fetch-failed', `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { uri?: unknown; expiryDate?: unknown };
  if (typeof body.uri !== 'string') {
    throw new OpenCryptoPayError('invalid-response', 'No payment URI in callback');
  }
  return {
    paymentUri: body.uri,
    expiresAt: parseExpiration(body.expiryDate),
  };
}

/**
 * Inform the OpenCryptoPay provider that we broadcasted the TX. The
 * provider rewrites the callback URL from `/cb/<id>` to `/tx/<id>`
 * (Flutter wallet does the same swap) and expects the `hex` of the
 * raw signed transaction so it can correlate the on-chain tx to the
 * merchant invoice.
 */
export async function commitTx(
  callbackUrl: string,
  args: { quoteId: string; asset: string; method: string; txHex: string },
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<{ txId: string }> {
  const rewritten = callbackUrl.replace('/cb/', '/tx/');
  const url = new URL(rewritten);
  url.searchParams.set('quote', args.quoteId);
  url.searchParams.set('asset', args.asset);
  url.searchParams.set('method', args.method);
  url.searchParams.set('hex', args.txHex.startsWith('0x') ? args.txHex : `0x${args.txHex}`);
  const fetchImpl = options?.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  } catch (err) {
    throw new OpenCryptoPayError(
      'commit-failed',
      err instanceof Error ? err.message : 'Network error',
    );
  }
  if (!res.ok) {
    throw new OpenCryptoPayError('commit-failed', `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { txId?: unknown };
  if (typeof body.txId !== 'string') {
    throw new OpenCryptoPayError('commit-failed', 'No txId in response');
  }
  return { txId: body.txId };
}

/**
 * Cancel an in-flight OCP quote — corresponds to the user abandoning
 * the confirm screen. Flutter wallet swaps `/cb/` → `/cancel/` and
 * issues a DELETE; same here.
 */
export async function cancelQuote(
  callbackUrl: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<void> {
  const rewritten = callbackUrl.replace('/cb/', '/cancel/');
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    await fetchImpl(rewritten, {
      method: 'DELETE',
      ...(options?.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // Cancel is fire-and-forget — if the provider doesn't get the
    // signal, the quote just times out on its own at `expiresAt`.
  }
}

/**
 * Parse OCP's heterogeneous expiration encoding into a UNIX ms
 * timestamp. The provider sometimes returns an ISO-8601 string, a
 * UNIX-seconds number, or a UNIX-ms number; normalise to the JS-native
 * Date.now() scale so the UI's countdown lines up with the device clock.
 */
function parseExpiration(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Parse an ERC-681 payment URI as returned by `getPaymentTarget`.
 *
 * The OCP provider returns either:
 *   - `ethereum:0xRecipient@1?value=12345…` (native send)
 *   - `ethereum:0xToken@1/transfer?address=0xRecipient&uint256=12345…` (ERC-20)
 *
 * Returns the recipient address + amount in the asset's smallest unit
 * as a decimal string. Callers handle the actual broadcast through WDK.
 */
export function parsePaymentUri(uri: string): {
  chainSlug: string;
  contract: string | null;
  recipient: string;
  amount: string;
} {
  // chain:address[@chainId][/function]?params
  const match = uri.match(
    // eslint-disable-next-line security/detect-unsafe-regex -- alternation is anchored + bounded character classes
    /^([a-z0-9-]+):(0x[0-9a-fA-F]+)(?:@(\d+))?(?:\/([a-zA-Z0-9]+))?(?:\?(.*))?$/,
  );
  if (!match) {
    throw new OpenCryptoPayError('invalid-response', `Unparseable payment URI: ${uri}`);
  }
  const chainSlug = match[1]!;
  const head = match[2]!;
  const fn = match[4];
  const query = match[5] ?? '';
  const params = new URLSearchParams(query);

  if (fn === 'transfer') {
    // ERC-20: head is the token contract; recipient + amount in params.
    const recipient = params.get('address') ?? '';
    const amount = params.get('uint256') ?? '0';
    if (!recipient) {
      throw new OpenCryptoPayError('invalid-response', 'ERC-20 transfer URI missing address');
    }
    return { chainSlug, contract: head, recipient, amount };
  }

  // Native send: head is the recipient; amount in `value`.
  const amount = params.get('value') ?? '0';
  return { chainSlug, contract: null, recipient: head, amount };
}
