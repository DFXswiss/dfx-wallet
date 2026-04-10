import { useCallback, useState } from 'react';
import { useWallet, wdkService } from '@tetherto/wdk-react-native-provider';
import type { ChainId } from '@/config/chains';

type SendState = {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
};

const CHAIN_TO_NETWORK: Record<ChainId, string> = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
};

/**
 * Hook for sending crypto via WDK.
 */
export function useSendFlow() {
  const { addresses, refreshWalletBalance } = useWallet();
  const [state, setState] = useState<SendState>({
    isLoading: false,
    txHash: null,
    error: null,
  });

  const send = useCallback(
    async (params: { chain: ChainId; to: string; amount: string }) => {
      const network = CHAIN_TO_NETWORK[params.chain];
      const fromAddress = (addresses as Record<string, string> | undefined)?.[network];

      if (!fromAddress) {
        setState({ isLoading: false, txHash: null, error: 'No wallet address for this chain' });
        return null;
      }

      setState({ isLoading: true, txHash: null, error: null });

      try {
        // TODO: Use wdkService.sendTransaction() when available
        // const tx = await wdkService.sendTransaction({
        //   network,
        //   from: fromAddress,
        //   to: params.to,
        //   amount: params.amount,
        // });
        // setState({ isLoading: false, txHash: tx.hash, error: null });
        // await refreshWalletBalance();
        // return tx.hash;

        throw new Error('Send not yet implemented — awaiting WDK sendTransaction API');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setState({ isLoading: false, txHash: null, error: msg });
        return null;
      }
    },
    [addresses, refreshWalletBalance],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, txHash: null, error: null });
  }, []);

  return { ...state, send, reset };
}
