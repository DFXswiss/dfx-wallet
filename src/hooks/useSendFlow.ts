import { useCallback, useState } from 'react';
import { useAccount, type IAsset } from '@tetherto/wdk-react-native-core';
import type { ChainId } from '@/config/chains';
import { parseUnits } from '@/config/portfolio-presentation';
import { useRefreshBalances } from '@/services/balances';

type SendState = {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
};

/**
 * Hook for sending an asset (native or ERC-20) via the WDK worklet.
 *
 * The send screen surfaces canonical symbols (USD/CHF/EUR/BTC) so the caller
 * resolves the actual `IAsset` (e.g. USDT-on-Polygon) and passes it in. The
 * user-typed display amount ("1", "0.5") is scaled here by the asset's
 * decimals before being handed to WDK, which expects amounts in the asset's
 * smallest unit.
 */
export type FeeEstimate = { success: true; fee: string } | { success: false; error: string };

export function useSendFlow(chain: ChainId) {
  const { send: sendFromAccount, estimateFee } = useAccount({
    network: chain,
    accountIndex: 0,
  });
  const refreshBalances = useRefreshBalances();
  const [state, setState] = useState<SendState>({
    isLoading: false,
    txHash: null,
    error: null,
  });

  const send = useCallback(
    async (params: { asset: IAsset; to: string; amount: string }) => {
      setState({ isLoading: true, txHash: null, error: null });

      try {
        const baseAmount = parseUnits(params.amount, params.asset.getDecimals());
        if (baseAmount === '0') {
          const msg = 'Amount must be greater than zero';
          setState({ isLoading: false, txHash: null, error: msg });
          return null;
        }

        const result = await sendFromAccount({
          asset: params.asset,
          to: params.to,
          amount: baseAmount,
        });

        if (!result.success) {
          const msg = result.error ?? 'Transaction failed';
          setState({ isLoading: false, txHash: null, error: msg });
          return null;
        }

        setState({ isLoading: false, txHash: result.hash, error: null });
        refreshBalances(0);
        return result.hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setState({ isLoading: false, txHash: null, error: msg });
        return null;
      }
    },
    [sendFromAccount, refreshBalances],
  );

  const estimate = useCallback(
    async (params: { asset: IAsset; to: string; amount: string }): Promise<FeeEstimate> => {
      try {
        const baseAmount = parseUnits(params.amount, params.asset.getDecimals());
        if (baseAmount === '0') {
          return { success: false, error: 'amount-zero' };
        }
        const result = await estimateFee({
          asset: params.asset,
          to: params.to,
          amount: baseAmount,
        });
        if (!result.success) {
          return { success: false, error: result.error ?? 'estimate-failed' };
        }
        return { success: true, fee: result.fee };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'estimate-failed',
        };
      }
    },
    [estimateFee],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, txHash: null, error: null });
  }, []);

  return { ...state, send, estimate, reset };
}
