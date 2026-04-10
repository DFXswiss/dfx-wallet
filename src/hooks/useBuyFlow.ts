import { useCallback, useState } from 'react';
import { dfxPaymentService } from '@/services/dfx';
import type { BuyPaymentInfoDto } from '@/services/dfx/dto';

type BuyState = {
  isLoading: boolean;
  paymentInfo: BuyPaymentInfoDto | null;
  error: string | null;
};

/**
 * Hook for the DFX Buy (fiat → crypto) flow.
 *
 * Steps:
 * 1. getQuote() — preview exchange rate and fees
 * 2. createPaymentInfo() — get SEPA bank details + reference code
 * 3. User transfers via bank
 * 4. confirmPayment() — mark as paid
 */
export function useBuyFlow() {
  const [state, setState] = useState<BuyState>({
    isLoading: false,
    paymentInfo: null,
    error: null,
  });

  const getQuote = useCallback(
    async (params: { amount: number; currency: string; asset: string; blockchain: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const info = await dfxPaymentService.getBuyQuote(params);
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
    async (params: { amount: number; currency: string; asset: string; blockchain: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const info = await dfxPaymentService.createBuyPaymentInfo(params);
        setState({ isLoading: false, paymentInfo: info, error: null });
        return info;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create payment info';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        return null;
      }
    },
    [],
  );

  const confirmPayment = useCallback(async (id: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await dfxPaymentService.confirmBuy(id);
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
    confirmPayment,
    reset,
  };
}
