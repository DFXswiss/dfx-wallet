import { useCallback, useState } from 'react';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { walletService } from '@/services/wallet/wallet-service';
import type { ChainId } from '@/config/chains';

type SendState = {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
};

/**
 * Hook for sending crypto via WDK wallet service.
 */
export function useSendFlow() {
  const { refreshWalletBalance } = useWallet();
  const [state, setState] = useState<SendState>({
    isLoading: false,
    txHash: null,
    error: null,
  });

  const send = useCallback(
    async (params: { chain: ChainId; to: string; amount: string }) => {
      setState({ isLoading: true, txHash: null, error: null });

      try {
        const txHash = await walletService.sendTransaction({
          chain: params.chain,
          to: params.to,
          amount: params.amount,
        });

        setState({ isLoading: false, txHash, error: null });
        await refreshWalletBalance();
        return txHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setState({ isLoading: false, txHash: null, error: msg });
        return null;
      }
    },
    [refreshWalletBalance],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, txHash: null, error: null });
  }, []);

  return { ...state, send, reset };
}
