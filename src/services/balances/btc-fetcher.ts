/**
 * Bitcoin on-chain balance + transaction lookups for arbitrary addresses.
 *
 * Used by the Portfolio rail's "Linked DFX wallets" cards and the
 * linked-wallet detail screen: the user might have linked a BTC wallet
 * from another device, so we cannot rely on the local WDK to know its
 * state. mempool.space is hit unauthenticated — the standard public API
 * used across the Bitcoin tooling ecosystem.
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

/**
 * Confirmed + mempool-pending transactions for an address — both lists
 * folded together in chronological-desc order, mirroring the per-chain
 * TX feed contract of the Blockscout client. Used by the linked-wallet
 * detail screen so a Bitcoin Vault with a balance never reads as
 * "Keine Transaktionen".
 *
 * Per-row shape mirrors the mempool.space `/api/address/{addr}/txs`
 * envelope; consumers normalise it into the unified `WalletTransaction`
 * shape further up.
 */
export type BtcTx = {
  txid: string;
  status: { confirmed: boolean; block_time?: number };
  vin: { prevout?: { scriptpubkey_address?: string; value: number } | null }[];
  vout: { scriptpubkey_address?: string; value: number }[];
};

export type BtcTxResult = { ok: true; value: BtcTx[] } | { ok: false; error: string };

export async function fetchBtcTransactions(
  address: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<BtcTxResult> {
  if (!address) return { ok: false, error: 'no address' };
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${MEMPOOL_BASE}/address/${encodeURIComponent(address)}/txs`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      ...(options?.signal ? { signal: options.signal } : {}),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as BtcTx[];
    if (!Array.isArray(json)) return { ok: true, value: [] };
    return { ok: true, value: json };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'aborted' };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'fetch failed' };
  }
}
