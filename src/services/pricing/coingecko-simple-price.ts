import type { FiatCurrency } from '@/services/pricing-service';

/**
 * On-demand `/simple/price` fetch for coin IDs we discover at runtime
 * (e.g. from the on-chain tokentx history). The main `pricingService`
 * primes a fixed curated list at boot; this helper exists so the
 * dynamic discovery path can resolve prices for tokens that weren't
 * known in advance without a second boot of the singleton.
 *
 * Batched in chunks of 100 IDs per request — CoinGecko free tier
 * supports the comma-joined `ids=` parameter up to roughly that
 * size before the URL trips Cloudflare's length limit.
 */

const COINGECKO_SIMPLE_PRICE = 'https://api.coingecko.com/api/v3/simple/price';
const BATCH_SIZE = 100;

export type SimplePriceMap = Map<string, Partial<Record<FiatCurrency, number>>>;

type SimplePriceResponse = Record<string, Partial<Record<string, number>>>;

function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (arr.length === 0) return [];
  if (arr.length <= size) return [Array.from(arr)];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Fetch price quotes for the given CoinGecko coin IDs in the requested
 * currencies. Returns a map keyed by id; missing entries mean
 * CoinGecko had no quote (rare for valid IDs).
 *
 * Rate-limit friendly: chunks at {@link BATCH_SIZE} per request and
 * gives up the entire batch on the first 4xx/5xx so a single bad
 * chunk doesn't poison the cache for the rest.
 */
export async function fetchSimplePrices(
  ids: readonly string[],
  currencies: readonly FiatCurrency[],
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal },
): Promise<SimplePriceMap> {
  const out: SimplePriceMap = new Map();
  if (ids.length === 0 || currencies.length === 0) return out;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const vs = currencies.map((c) => c.toLowerCase()).join(',');

  for (const batch of chunk(ids, BATCH_SIZE)) {
    const params = new URLSearchParams({
      ids: batch.join(','),
      vs_currencies: vs,
    });
    let res: Response;
    try {
      res = await fetchImpl(`${COINGECKO_SIMPLE_PRICE}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        ...(options?.signal ? { signal: options.signal } : {}),
      });
    } catch {
      // Network failure — skip this batch, leave the rest of the
      // discovery cache intact rather than failing the whole hook.
      continue;
    }
    if (!res.ok) continue;
    let payload: SimplePriceResponse;
    try {
      payload = (await res.json()) as SimplePriceResponse;
    } catch {
      continue;
    }
    for (const [coinId, raw] of Object.entries(payload)) {
      if (!raw) continue;
      const entry: Partial<Record<FiatCurrency, number>> = {};
      for (const currency of currencies) {
        const lc = currency.toLowerCase();
        // eslint-disable-next-line security/detect-object-injection -- lc derived from a typed FiatCurrency enum
        const price = raw[lc];
        if (typeof price === 'number' && Number.isFinite(price)) {
          // eslint-disable-next-line security/detect-object-injection -- currency is a typed enum value
          entry[currency] = price;
        }
      }
      out.set(coinId, entry);
    }
  }
  return out;
}
