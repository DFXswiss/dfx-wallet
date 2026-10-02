import type { BalanceFetchStrategy } from '@/config/tokens';

/**
 * The strategy this balance came from. Matches `BalanceFetchStrategy` so the
 * coordinator can attribute each entry back to its source for debugging /
 * UI ("loaded via WDK", "RPC error on Polygon", etc.).
 */
export type BalanceSourceId = BalanceFetchStrategy;

export type BalanceStatus = 'loading' | 'ok' | 'error' | 'idle';

/**
 * A single asset's balance as observed by one source. Raw integer string at
 * the asset's smallest unit (e.g. wei for ETH, satoshis for BTC) — kept as
 * a string to preserve precision past 2^53.
 */
export type BalanceEntry = {
  assetId: string;
  rawBalance: string;
  status: BalanceStatus;
  source: BalanceSourceId;
  error?: string;
  fetchedAt?: number;
};

/** Coordinator output: balance entry per asset id. */
export type BalanceMap = ReadonlyMap<string, BalanceEntry>;

/** Common shape every balance-source hook returns. */
export type BalanceSourceResult = {
  data: BalanceMap;
  isLoading: boolean;
  error: Error | null;
};
