import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount, type IAsset } from '@tetherto/wdk-react-native-core';
import { getEvmRpcUrl, type ChainId } from '@/config/chains';
import { getAssetMeta } from '@/config/tokens';
import { EvmBalanceFetcher, type EvmAssetSpec } from './evm-fetcher';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from './types';

const sharedFetcher = new EvmBalanceFetcher(getEvmRpcUrl);

const STALE_TIME_MS = 15_000;
const REFETCH_INTERVAL_MS = 30_000;
const EMPTY_BALANCES: BalanceMap = new Map();

/** Prefix shared with `useRefreshBalances` so invalidation matches every key. */
export const EVM_BALANCES_QUERY_KEY_PREFIX = ['balances', 'evm'] as const;

/**
 * Fetches balances for `evm` strategy assets via direct JSON-RPC.
 *
 * Per-chain address derivation goes through `useAccount` rather than
 * `useAddresses` so this hook works even on a fresh launch where no other
 * screen has touched a given chain yet. Hook order is fixed (one call per
 * EVM chain) so Rules of Hooks are satisfied.
 */
export function useEvmBalances(assets: IAsset[], accountIndex = 0): BalanceSourceResult {
  const ethAccount = useAccount({ network: 'ethereum', accountIndex });
  const arbAccount = useAccount({ network: 'arbitrum', accountIndex });
  const polygonAccount = useAccount({ network: 'polygon', accountIndex });
  const baseAccount = useAccount({ network: 'base', accountIndex });
  const plasmaAccount = useAccount({ network: 'plasma', accountIndex });
  const sepoliaAccount = useAccount({ network: 'sepolia', accountIndex });

  const addressByChain = useMemo<ReadonlyMap<ChainId, string>>(() => {
    const map = new Map<ChainId, string>();
    if (ethAccount.address) map.set('ethereum', ethAccount.address);
    if (arbAccount.address) map.set('arbitrum', arbAccount.address);
    if (polygonAccount.address) map.set('polygon', polygonAccount.address);
    if (baseAccount.address) map.set('base', baseAccount.address);
    if (plasmaAccount.address) map.set('plasma', plasmaAccount.address);
    if (sepoliaAccount.address) map.set('sepolia', sepoliaAccount.address);
    return map;
  }, [
    ethAccount.address,
    arbAccount.address,
    polygonAccount.address,
    baseAccount.address,
    plasmaAccount.address,
    sepoliaAccount.address,
  ]);

  const specs = useMemo<EvmAssetSpec[]>(
    () =>
      assets
        .map((asset): EvmAssetSpec | null => {
          const meta = getAssetMeta(asset.getId());
          if (!meta || meta.balanceFetchStrategy !== 'evm') return null;
          return {
            assetId: asset.getId(),
            network: meta.network,
            isNative: meta.isNative,
            tokenAddress: meta.address ?? null,
          };
        })
        .filter((s): s is EvmAssetSpec => s !== null),
    [assets],
  );

  const queryKey = useMemo(() => {
    const ids = specs
      .map((s) => s.assetId)
      .sort()
      .join(',');
    const addrs = Array.from(addressByChain.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([c, a]) => `${c}:${a}`)
      .join('|');
    return [...EVM_BALANCES_QUERY_KEY_PREFIX, accountIndex, ids, addrs] as const;
  }, [specs, addressByChain, accountIndex]);

  const enabled = specs.length > 0 && addressByChain.size > 0;

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<BalanceMap> => {
      const result = await sharedFetcher.fetch(specs, addressByChain);
      const map = new Map<string, BalanceEntry>();
      const fetchedAt = Date.now();
      for (const spec of specs) {
        const r = result.get(spec.assetId);
        if (!r) {
          map.set(spec.assetId, {
            assetId: spec.assetId,
            rawBalance: '0',
            status: 'idle',
            source: 'evm',
            fetchedAt,
          });
        } else if ('rawBalance' in r) {
          map.set(spec.assetId, {
            assetId: spec.assetId,
            rawBalance: r.rawBalance,
            status: 'ok',
            source: 'evm',
            fetchedAt,
          });
        } else {
          map.set(spec.assetId, {
            assetId: spec.assetId,
            rawBalance: '0',
            status: 'error',
            source: 'evm',
            error: r.error,
            fetchedAt,
          });
        }
      }
      return map;
    },
    enabled,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  return {
    data: data ?? EMPTY_BALANCES,
    isLoading: enabled && isLoading,
    error: error ?? null,
  };
}
