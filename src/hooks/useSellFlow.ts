import { useCallback, useState } from 'react';
import { dfxPaymentService } from '@/services/dfx';
import type { SellPaymentInfoDto } from '@/services/dfx/dto';

type SellState = {
  isLoading: boolean;
  paymentInfo: SellPaymentInfoDto | null;
  error: string | null;
};

/**
 * Hook for the DFX Sell (crypto → fiat) flow.
 *
 * Steps:
 * 1. getQuote() — preview exchange rate and fees
 * 2. createPaymentInfo() — get deposit address
 * 3. User sends crypto to deposit address (via WDK or BitBox)
 * 4. confirmSell() — confirm with signature
 */
export function useSellFlow() {
  const [state, setState] = useState<SellState>({
    isLoading: false,
    paymentInfo: null,
    error: null,
  });

  const getQuote = useCallback(
    async (params: {
      amount: number;
      asset: string;
      blockchain: string;
      currency: string;
    }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const info = await dfxPaymentService.getSellQuote(params);
        setState({ isLoading: false, paymentInfo: info, error: null });
        return info;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Quote failed';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return null;
      }
    },
    [],
  );

  const createPaymentInfo = useCallback(
    async (params: {
      amount: number;
      asset: string;
      blockchain: string;
      currency: string;
      iban: string;
    }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const info = await dfxPaymentService.createSellPaymentInfo(params);
        setState({ isLoading: false, paymentInfo: info, error: null });
        return info;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create sell order';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return null;
      }
    },
    [],
  );

  const confirmSell = useCallback(async (id: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await dfxPaymentService.confirmSell(id);
      setState((s) => ({ ...s, isLoading: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, paymentInfo: null, error: null });
  }, []);

  return {
    ...state,
    getQuote,
    createPaymentInfo,
    confirmSell,
    reset,
  };
}
