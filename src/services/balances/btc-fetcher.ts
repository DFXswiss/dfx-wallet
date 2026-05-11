/**
 * Bitcoin on-chain balance lookup for arbitrary addresses.
 *
 * Used by the Portfolio rail's "Linked DFX wallets" cards: the user might
 * have linked a BTC wallet from another device, so we cannot rely on the
 * local WDK to know its balance. mempool.space is hit unauthenticated —
 * the standard public API used across the Bitcoin tooling ecosystem.
 *
 * Returns satoshi as a decimal string so the caller can convert via the
 * shared `formatBalance(_, 8)` path that already powers the rest of the
 * portfolio code.
 */

const MEMPOOL_BASE = 'https://mempool.space/api';

type ChainStatsResponse = {
  chain_stats?: {
    funded_txo_sum?: number;
    spent_txo_sum?: number;
  };
  mempool_stats?: {
    funded_txo_sum?: number;
    spent_txo_sum?: number;
  };
};

export type BtcBalanceResult = { rawBalance: string } | { error: string };

export async function fetchBtcBalance(
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<BtcBalanceResult> {
  if (!address) return { error: 'no address' };
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${MEMPOOL_BASE}/address/${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const json = (await res.json()) as ChainStatsResponse;
    // Confirmed balance only — pending mempool transactions can revert and
    // would inflate the displayed sum during a few minutes of uncertainty.
    const chain = json.chain_stats;
    if (!chain || typeof chain.funded_txo_sum !== 'number') {
      return { error: 'no chain_stats' };
    }
    const funded = BigInt(chain.funded_txo_sum);
    const spent = BigInt(chain.spent_txo_sum ?? 0);
    const sat = funded - spent;
    return { rawBalance: (sat < 0n ? 0n : sat).toString() };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { error: 'aborted' };
    }
    return { error: err instanceof Error ? err.message : 'fetch failed' };
  }
}
