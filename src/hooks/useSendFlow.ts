import { useCallback, useState } from 'react';
import { useRefreshBalance, useWallet, useWalletManager } from '@tetherto/wdk-react-native-core';
import type { ChainId } from '@/config/chains';

type SendState = {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
};

type TransferResult = string | { hash?: string; transactionHash?: string };

const extractHash = (result: TransferResult): string => {
  if (typeof result === 'string') return result;
  return result.hash ?? result.transactionHash ?? '';
};

/**
 * Hook for sending crypto via the WDK worklet.
 */
export function useSendFlow() {
  const { wallets, activeWalletId } = useWalletManager();
  const currentWalletId = activeWalletId || wallets[0]?.identifier || 'default';
  const { callAccountMethod } = useWallet({ walletId: currentWalletId });
  const { mutate: refreshBalance } = useRefreshBalance();
  const [state, setState] = useState<SendState>({
    isLoading: false,
    txHash: null,
    error: null,
  });

  const send = useCallback(
    async (params: { chain: ChainId; to: string; amount: string }) => {
      setState({ isLoading: true, txHash: null, error: null });

      try {
        const result = await callAccountMethod<TransferResult>(params.chain, 0, 'transfer', {
          to: params.to,
          amount: params.amount,
        });

        const txHash = extractHash(result);
        setState({ isLoading: false, txHash, error: null });
        refreshBalance({ accountIndex: 0, type: 'wallet' });
        return txHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setState({ isLoading: false, txHash: null, error: msg });
        return null;
      }
    },
    [callAccountMethod, refreshBalance],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, txHash: null, error: null });
  }, []);

  return { ...state, send, reset };
}
