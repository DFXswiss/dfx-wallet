import { useCallback, useRef, useState } from 'react';
import type { ChainId } from '@/config/chains';
import { dfxPaymentService, interpretDfxAuthError } from '@/services/dfx';
import type { DfxAuthGateState } from '@/services/dfx';
import type { BuyPaymentInfoDto } from '@/services/dfx/dto';

type QuoteParams = {
  amount: number;
  currency: string;
  asset: string;
  blockchain: string;
  /**
   * WDK chain id for the selected variant — used to drive the linkChain
   * gate (we sign with this chain's wallet to attach it to the DFX user).
   */
  chain: ChainId;
};

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
      // Attach the WDK chain id of the last attempted call so the linkChain
      // gate can sign with the right wallet.
      const enriched: DfxAuthGateState =
        gate.kind === 'linkChain' && lastAction.current
          ? { ...gate, chain: lastAction.current.params.chain }
          : gate;
      setState((s) => ({ ...s, isLoading: false, authGate: enriched, error: null }));
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
      // Normalise: DFX' BuyQuoteDto returns `errors` as an array; older
      // responses use a singular `error`. We collapse to a single `error`
      // so the buy screen's display logic stays simple.
      const firstError = info.errors && info.errors.length > 0 ? info.errors[0] : undefined;
      const normalised = info.error || !firstError ? info : { ...info, error: firstError };
      setState({ isLoading: false, paymentInfo: normalised, error: null, authGate: null });
      return normalised;
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
