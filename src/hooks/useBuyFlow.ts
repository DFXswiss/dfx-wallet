import { useCallback, useState } from 'react';
import { dfxPaymentService, interpretDfxAuthError } from '@/services/dfx';
import type { DfxAuthGateState } from '@/services/dfx';
import type { BuyPaymentInfoDto } from '@/services/dfx/dto';

type BuyState = {
  isLoading: boolean;
  paymentInfo: BuyPaymentInfoDto | null;
  error: string | null;
  authGate: DfxAuthGateState | null;
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
    authGate: null,
  });

  const handleError = (err: unknown, fallback: string) => {
    const gate = interpretDfxAuthError(err);
    if (gate) {
      setState((s) => ({ ...s, isLoading: false, authGate: gate, error: null }));
      return;
    }
    const msg = err instanceof Error ? err.message : fallback;
    setState((s) => ({ ...s, isLoading: false, error: msg }));
  };

  const getQuote = useCallback(
    async (params: { amount: number; currency: string; asset: string; blockchain: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null, authGate: null }));
      try {
        const info = await dfxPaymentService.getBuyQuote(params);
        setState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
        return info;
      } catch (err) {
        handleError(err, 'Quote failed');
        return null;
      }
    },
    [],
  );

  const createPaymentInfo = useCallback(
    async (params: { amount: number; currency: string; asset: string; blockchain: string }) => {
      setState((s) => ({ ...s, isLoading: true, error: null, authGate: null }));
      try {
        const info = await dfxPaymentService.createBuyPaymentInfo(params);
        setState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
        return info;
      } catch (err) {
        handleError(err, 'Failed to create payment info');
        return null;
      }
    },
    [],
  );

  const confirmPayment = useCallback(async (id: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null }));
    try {
      await dfxPaymentService.confirmBuy(id);
      setState((s) => ({ ...s, isLoading: false }));
      return true;
    } catch (err) {
      handleError(err, 'Confirmation failed');
      return false;
    }
  }, []);

  const dismissAuthGate = useCallback(() => {
    setState((s) => ({ ...s, authGate: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, paymentInfo: null, error: null, authGate: null });
  }, []);

  return {
    ...state,
    getQuote,
    createPaymentInfo,
    confirmPayment,
    dismissAuthGate,
    reset,
  };
}
