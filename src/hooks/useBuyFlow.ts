import { useCallback, useRef, useState } from 'react';
import { dfxPaymentService, interpretDfxAuthError } from '@/services/dfx';
import type { DfxAuthGateState } from '@/services/dfx';
import type { BuyPaymentInfoDto } from '@/services/dfx/dto';

type QuoteParams = { amount: number; currency: string; asset: string; blockchain: string };

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

  // Remember the last attempted call so we can replay it after the user
  // clears the auth gate via the sign-in modal.
  const lastAction = useRef<{ kind: 'quote' | 'paymentInfo'; params: QuoteParams } | null>(null);

  const handleError = (err: unknown, fallback: string) => {
    const gate = interpretDfxAuthError(err);
    if (gate) {
      setState((s) => ({ ...s, isLoading: false, authGate: gate, error: null }));
      return;
    }
    const msg = err instanceof Error ? err.message : fallback;
    setState((s) => ({ ...s, isLoading: false, error: msg }));
  };

  const getQuote = useCallback(async (params: QuoteParams) => {
    lastAction.current = { kind: 'quote', params };
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null }));
    try {
      const info = await dfxPaymentService.getBuyQuote(params);
      setState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
      return info;
    } catch (err) {
      handleError(err, 'Quote failed');
      return null;
    }
  }, []);

  const createPaymentInfo = useCallback(async (params: QuoteParams) => {
    lastAction.current = { kind: 'paymentInfo', params };
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null }));
    try {
      const info = await dfxPaymentService.createBuyPaymentInfo(params);
      setState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
      return info;
    } catch (err) {
      handleError(err, 'Failed to create payment info');
      return null;
    }
  }, []);

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

  /**
   * Re-run the call that triggered the auth gate. Wired into the gate's
   * onAuthenticated callback so a successful sign-in transparently advances
   * the flow without forcing the user to type their amount in again.
   */
  const retryLast = useCallback(async () => {
    const last = lastAction.current;
    if (!last) return;
    if (last.kind === 'quote') {
      await getQuote(last.params);
    } else {
      await createPaymentInfo(last.params);
    }
  }, [getQuote, createPaymentInfo]);

  const reset = useCallback(() => {
    lastAction.current = null;
    setState({ isLoading: false, paymentInfo: null, error: null, authGate: null });
  }, []);

  return {
    ...state,
    getQuote,
    createPaymentInfo,
    confirmPayment,
    dismissAuthGate,
    retryLast,
    reset,
  };
}
