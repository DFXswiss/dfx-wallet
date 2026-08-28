import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRefreshBalance as useWdkRefreshBalance } from '@tetherto/wdk-react-native-core';
import { EVM_BALANCES_QUERY_KEY_PREFIX } from './useEvmBalances';

/**
 * Returns a callback that forces every balance source to refetch on its next
 * render — call after a state-changing action (send / receive confirmation /
 * deposit) so the UI reflects on-chain truth instead of stale cache.
 *
 * Hits both sources: invalidates our EVM TanStack Query and triggers WDK's
 * own `useRefreshBalance` mutation. If a third source is added, this is the
 * place to wire it.
 */
export function useRefreshBalances(): (accountIndex?: number) => void {
  const queryClient = useQueryClient();
  const { mutate: refreshWdk } = useWdkRefreshBalance();

  return useCallback(
    (accountIndex = 0) => {
      void queryClient.invalidateQueries({ queryKey: EVM_BALANCES_QUERY_KEY_PREFIX });
      refreshWdk({ accountIndex, type: 'wallet' });
    },
    [queryClient, refreshWdk],
  );
}
