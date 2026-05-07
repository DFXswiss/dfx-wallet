import { useMemo } from 'react';
import type { IAsset } from '@tetherto/wdk-react-native-core';
import { useEvmBalances } from './useEvmBalances';
import { useWdkBalances } from './useWdkBalances';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from './types';

/**
 * Coordinator over all balance sources. Pass the full asset list — each asset
 * is routed to the source matching its `balanceFetchStrategy` (set in
 * `tokens.ts`) and the per-source maps are merged into a single
 * `BalanceMap` keyed by asset id.
 *
 * Adding a new source (e.g. a third-party indexer) is a matter of dropping a
 * new `useXxxBalances` hook here and merging it in below — no consumer needs
 * to change.
 */
export function useBalances(assets: IAsset[], accountIndex = 0): BalanceSourceResult {
  const wdk = useWdkBalances(assets, accountIndex);
  const evm = useEvmBalances(assets, accountIndex);

  const merged = useMemo<BalanceMap>(() => {
    const out = new Map<string, BalanceEntry>();
    for (const [k, v] of wdk.data) out.set(k, v);
    for (const [k, v] of evm.data) out.set(k, v);
    return out;
  }, [wdk.data, evm.data]);

  return {
    data: merged,
    isLoading: wdk.isLoading || evm.isLoading,
    error: wdk.error ?? evm.error ?? null,
  };
}

/** Convenience reader: raw balance string at the asset's smallest unit. */
export const getRawBalance = (map: BalanceMap, assetId: string): string =>
  map.get(assetId)?.rawBalance ?? '0';
