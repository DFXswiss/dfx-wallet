import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAddresses } from '@tetherto/wdk-react-native-core';
import { getAssets } from '@/config/tokens';
import { createIndexerClient, getIndexerTokenTransferQuery } from '@/services/wdk-indexer';
import type { IndexerTokenTransfer } from '@/services/wdk-indexer/types';
import { debugLog } from '@/utils/debugLog';

export type OnchainTransferListItem = IndexerTokenTransfer & { listKey: string };

type PlannedTransferFetch = {
  blockchain: string;
  token: string;
  address: string;
};

export function useOnchainTokenTransfers(accountIndex: number) {
  const assetConfigs = useMemo(() => getAssets(), []);
  const networks = useMemo(
    () => [...new Set(assetConfigs.map((a) => a.getNetwork()))],
    [assetConfigs],
  );
  const indexer = useMemo(() => createIndexerClient(), []);
  const { data: addressRows, isLoading: addressesLoading, loadAddresses, getAddressesForNetwork } =
    useAddresses();

  const [items, setItems] = useState<OnchainTransferListItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchGeneration = useRef(0);

  useEffect(() => {
    if (!indexer) return;
    void loadAddresses([accountIndex], networks);
  }, [indexer, loadAddresses, accountIndex, networks]);

  const refetch = useCallback(async () => {
    if (!indexer) {
      setItems([]);
      setError(null);
      return;
    }

    const gen = ++fetchGeneration.current;

    setIsFetching(true);
    setError(null);

    const planned: PlannedTransferFetch[] = [];
    for (const asset of assetConfigs) {
      const network = asset.getNetwork();
      const addrs = getAddressesForNetwork(network);
      const match = addrs.find((a) => a.accountIndex === accountIndex);
      if (!match?.address) continue;
      const query = getIndexerTokenTransferQuery(asset, match.address);
      if (!query) continue;
      planned.push({ ...query, address: match.address });
    }

    debugLog('OnchainTransfers', 'fetch start', { indexerCalls: planned.length });

    try {
      const tasks = planned.map(({ blockchain, token, address }) =>
        indexer
          .getTokenTransfers({ blockchain, token, address })
          .catch((e) => {
            debugLog('OnchainTransfers', `fail ${blockchain}/${token}`, String(e));
            return [] as IndexerTokenTransfer[];
          }),
      );

      const chunks = await Promise.all(tasks);

      if (gen !== fetchGeneration.current) return;

      const merged = chunks.flat();
      const byKey = new Map<string, OnchainTransferListItem>();

      for (const tx of merged) {
        const key = `${tx.hash}-${tx.token}-${tx.blockchain}-${tx.timestamp}-${tx.amount}-${tx.direction}`;
        if (!byKey.has(key)) {
          byKey.set(key, { ...tx, listKey: key });
        }
      }

      const sorted = [...byKey.values()].sort((a, b) => b.timestamp - a.timestamp);
      setItems(sorted.slice(0, 100));
      debugLog('OnchainTransfers', 'fetch done', { count: sorted.length });
    } catch (e) {
      if (gen !== fetchGeneration.current) return;
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      if (gen === fetchGeneration.current) {
        setIsFetching(false);
      }
    }
  }, [indexer, assetConfigs, getAddressesForNetwork, accountIndex]);

  useEffect(() => {
    if (!indexer) {
      setItems([]);
      setError(null);
      return;
    }
    if (addressesLoading) return;
    void refetch();
  }, [indexer, addressesLoading, addressRows, refetch]);

  const isLoading = Boolean(indexer) && (addressesLoading || isFetching);

  return {
    items,
    error,
    isLoading,
    refetch,
    indexerEnabled: Boolean(indexer),
  };
}
