import { useMemo } from 'react';
import { useBalancesForWallet, type IAsset } from '@tetherto/wdk-react-native-core';
import { assetIncludedInWdkBalanceQuery } from '@/config/tokens';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from './types';

const EMPTY_BALANCES: BalanceMap = new Map();

/**
 * Fetches balances for `wdk` strategy assets via the WDK worklet hook. Filters
 * the input list down to WDK-strategy assets so callers can pass the same
 * full asset list they use for everything else.
 */
export function useWdkBalances(assets: IAsset[], accountIndex = 0): BalanceSourceResult {
  const wdkAssets = useMemo(
    () => assets.filter((a) => assetIncludedInWdkBalanceQuery(a)),
    [assets],
  );
  const { data, isLoading, error } = useBalancesForWallet(accountIndex, wdkAssets);

  const map = useMemo<BalanceMap>(() => {
    if (!data) return EMPTY_BALANCES;
    const out = new Map<string, BalanceEntry>();
    const fetchedAt = Date.now();
    for (const r of data) {
      if (r.success) {
        out.set(r.assetId, {
          assetId: r.assetId,
          rawBalance: r.balance ?? '0',
          status: 'ok',
          source: 'wdk',
          fetchedAt,
        });
      } else {
        const entry: BalanceEntry = {
          assetId: r.assetId,
          rawBalance: '0',
          status: 'error',
          source: 'wdk',
          fetchedAt,
        };
        if (r.error) entry.error = r.error;
        out.set(r.assetId, entry);
      }
    }
    return out;
  }, [data]);

  return { data: map, isLoading, error };
}
