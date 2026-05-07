import { useCallback, useRef, useState } from 'react';
import type { ChainId } from '@/config/chains';
import { dfxPaymentService, interpretDfxAuthError } from '@/services/dfx';
import type { DfxAuthGateState } from '@/services/dfx';
import type { SellPaymentInfoDto } from '@/services/dfx/dto';

type QuoteParams = {
  amount: number;
  asset: string;
  blockchain: string;
  currency: string;
  chain: ChainId;
};
type PaymentInfoParams = QuoteParams & { iban: string };

type SellState = {
  isLoading: boolean;
  paymentInfo: SellPaymentInfoDto | null;
  error: string | null;
  authGate: DfxAuthGateState | null;
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
    authGate: null,
  });

  const lastAction = useRef<
    | { kind: 'quote'; params: QuoteParams }
    | { kind: 'paymentInfo'; params: PaymentInfoParams }
    | null
  >(null);

  const handleError = (err: unknown, fallback: string) => {
    const gate = interpretDfxAuthError(err);
    if (gate) {
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
      const info = await dfxPaymentService.getSellQuote(params);
      setState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
      return info;
    } catch (err) {
      handleError(err, 'Quote failed');
      return null;
    }
  }, []);

  const createPaymentInfo = useCallback(async (params: PaymentInfoParams) => {
    lastAction.current = { kind: 'paymentInfo', params };
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null }));
    try {
      const info = await dfxPaymentService.createSellPaymentInfo(params);
      setState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
      return info;
    } catch (err) {
      handleError(err, 'Failed to create sell order');
      return null;
    }
  }, []);

  const confirmSell = useCallback(async (id: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null }));
    try {
      await dfxPaymentService.confirmSell(id);
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
    confirmSell,
    dismissAuthGate,
    retryLast,
    reset,
  };
}
