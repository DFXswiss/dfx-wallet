import type { ChainId } from '@/config/chains';

/**
 * `coins/list?include_platform=true` cache.
 *
 * The endpoint returns every CoinGecko-listed coin with the contract
 * address it has on each blockchain platform we care about. We use it
 * as the "is this on CoinGecko?" filter the user explicitly asked for —
 * any token discovered on-chain that *doesn't* appear in this list (no
 * matching platform contract) gets dropped before we render anything.
 *
 * Response is ~2.6 MB / 17 000 coins (Nov 2026), so we keep it module-
 * level with a 24 h staleness window — well within CoinGecko's free
 * tier rate-limit and small enough that re-fetching once a day costs
 * nothing.
 */

const COINGECKO_LIST_URL = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Map our `ChainId` to CoinGecko's platform-key string. CoinGecko uses
 * slugs that don't match either our internal IDs or the chain's RPC
 * name (`arbitrum-one`, not `arbitrum`, …). See `/coins/list` payload
 * top-frequency platforms; tests assert these values stay stable.
 */
export const COINGECKO_PLATFORM: Record<ChainId, string | null> = {
  ethereum: 'ethereum',
  arbitrum: 'arbitrum-one',
  polygon: 'polygon-pos',
  base: 'base',
  bitcoin: null,
  'bitcoin-taproot': null,
  'bitcoin-lightning': null,
  spark: null,
  plasma: null,
  sepolia: null,
};

export type CoinGeckoCoin = {
  id: string;
  symbol: string;
  name: string;
  platforms?: Partial<Record<string, string | null>>;
};

type CacheState = {
  /** `(chainId → contract-address-lowercase → coingecko coin id)` index. */
  byPlatform: Map<string, Map<string, string>>;
  fetchedAt: number;
};

let cache: CacheState | null = null;
let inflight: Promise<CacheState> | null = null;

function buildIndex(coins: CoinGeckoCoin[]): Map<string, Map<string, string>> {
  const byPlatform = new Map<string, Map<string, string>>();
  for (const coin of coins) {
    const platforms = coin.platforms ?? {};
    for (const [platform, contract] of Object.entries(platforms)) {
      if (typeof contract !== 'string' || contract.length === 0) continue;
      const lc = contract.toLowerCase();
      let map = byPlatform.get(platform);
      if (!map) {
        map = new Map();
        byPlatform.set(platform, map);
      }
      // First match wins. CoinGecko occasionally lists multiple coins
      // against the same contract (forks, archived entries); we trust
      // the canonical first-seen entry.
      if (!map.has(lc)) map.set(lc, coin.id);
    }
  }
  return byPlatform;
}

async function fetchAndIndex(fetchImpl: typeof fetch): Promise<CacheState> {
  const res = await fetchImpl(COINGECKO_LIST_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CoinGecko coins/list HTTP ${res.status}`);
  const coins = (await res.json()) as CoinGeckoCoin[];
  if (!Array.isArray(coins)) throw new Error('CoinGecko coins/list payload not an array');
  return { byPlatform: buildIndex(coins), fetchedAt: Date.now() };
}

async function getCache(fetchImpl: typeof fetch = fetch): Promise<CacheState> {
  if (cache && Date.now() - cache.fetchedAt < STALE_AFTER_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      cache = await fetchAndIndex(fetchImpl);
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Resolve an on-chain ERC-20 contract address to the CoinGecko coin id
 * we feed into `/simple/price`. Returns `null` when the contract isn't
 * on CoinGecko — caller drops the token from the discovery output per
 * the user's "only CoinGecko-listed tokens" spec.
 */
export async function lookupCoinId(
  chain: ChainId,
  contract: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<string | null> {
  // eslint-disable-next-line security/detect-object-injection -- typed ChainId
  const platform = COINGECKO_PLATFORM[chain];
  if (!platform) return null;
  const state = await getCache(options?.fetchImpl ?? fetch);
  return state.byPlatform.get(platform)?.get(contract.toLowerCase()) ?? null;
}

/**
 * Bulk variant for batches of contracts on the same chain. Single
 * coins/list cache lookup, no per-call cache check overhead. Returns
 * `Map<contract-lowercase → coingeckoId>` containing only the matches.
 */
export async function lookupCoinIds(
  chain: ChainId,
  contracts: readonly string[],
  options?: { fetchImpl?: typeof fetch },
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // eslint-disable-next-line security/detect-object-injection -- typed ChainId
  const platform = COINGECKO_PLATFORM[chain];
  if (!platform || contracts.length === 0) return out;
  const state = await getCache(options?.fetchImpl ?? fetch);
  const platformIndex = state.byPlatform.get(platform);
  if (!platformIndex) return out;
  for (const c of contracts) {
    const id = platformIndex.get(c.toLowerCase());
    if (id) out.set(c.toLowerCase(), id);
  }
  return out;
}

/** Test-only: reset the in-memory cache so test cases get a clean slate. */
export function __resetCoingeckoCoinsList(): void {
  cache = null;
  inflight = null;
}
