import { useCallback, useMemo, useState } from 'react';
import { useAccount, useRefreshBalance } from '@tetherto/wdk-react-native-core';
import type { ChainId } from '@/config/chains';
import { getNativeAsset } from '@/config/tokens';

type SendState = {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
};

/**
 * Hook for sending the native asset on a given chain via the WDK worklet.
 *
 * The new wdk-react-native-core API exposes a per-account hook (`useAccount`)
 * with a typed `send({ asset, to, amount })` method, replacing the old
 * `useWallet().callAccountMethod(network, idx, 'transfer', ...)` plumbing.
 */
export function useSendFlow(chain: ChainId) {
  const { send: sendFromAccount } = useAccount({ network: chain, accountIndex: 0 });
  const { mutate: refreshBalance } = useRefreshBalance();
  const nativeAsset = useMemo(() => getNativeAsset(chain), [chain]);
  const [state, setState] = useState<SendState>({
    isLoading: false,
    txHash: null,
    error: null,
  });

  const send = useCallback(
    async (params: { to: string; amount: string }) => {
      if (!nativeAsset) {
        const msg = `No native asset configured for ${chain}`;
        setState({ isLoading: false, txHash: null, error: msg });
        return null;
      }

      setState({ isLoading: true, txHash: null, error: null });

      try {
        const result = await sendFromAccount({
          asset: nativeAsset,
          to: params.to,
          amount: params.amount,
        });

        if (!result.success) {
          const msg = result.error ?? 'Transaction failed';
          setState({ isLoading: false, txHash: null, error: msg });
          return null;
        }

        setState({ isLoading: false, txHash: result.hash, error: null });
        refreshBalance({ accountIndex: 0, type: 'wallet' });
        return result.hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setState({ isLoading: false, txHash: null, error: msg });
        return null;
      }
    },
    [chain, nativeAsset, sendFromAccount, refreshBalance],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, txHash: null, error: null });
  }, []);

  return { ...state, send, reset };
}
