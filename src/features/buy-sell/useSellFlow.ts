import { useCallback, useEffect, useRef, useState } from 'react';
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

export type SellStatus = 'idle' | 'loading' | 'success' | 'invalid' | 'authGate' | 'error';

type SellState = {
  status: SellStatus;
  isLoading: boolean;
  paymentInfo: SellPaymentInfoDto | null;
  error: string | null;
  authGate: DfxAuthGateState | null;
};

const INITIAL_STATE: SellState = {
  status: 'idle',
  isLoading: false,
  paymentInfo: null,
  error: null,
  authGate: null,
};

function deriveStatus(s: Omit<SellState, 'status'>): SellStatus {
  if (s.authGate) return 'authGate';
  if (s.error) return 'error';
  if (s.isLoading) return 'loading';
  if (!s.paymentInfo) return 'idle';
  if (s.paymentInfo.isValid) return 'success';
  return 'invalid';
}

/**
 * Hook for the DFX Sell (crypto → fiat) flow.
 *
 * Steps:
 * 1. getQuote() — preview exchange rate and fees
 * 2. createPaymentInfo() — get deposit address
 * 3. User sends crypto to deposit address (via WDK or BitBox)
 * 4. confirmSell() — confirm with signature
 *
 * Quote calls cancel any in-flight predecessor via AbortController so a
 * fast-typing user never sees a stale fee number flash in.
 */
export function useSellFlow() {
  const [state, setState] = useState<SellState>(INITIAL_STATE);

  const setSellState = (next: Omit<SellState, 'status'>) => {
    setState({ ...next, status: deriveStatus(next) });
  };

  const lastAction = useRef<
    | { kind: 'quote'; params: QuoteParams }
    | { kind: 'paymentInfo'; params: PaymentInfoParams }
    | null
  >(null);
  const quoteAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      quoteAbortRef.current?.abort();
    };
  }, []);

  const handleError = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.name === 'AbortError') return;
    const gate = interpretDfxAuthError(err);
    if (gate) {
      const enriched: DfxAuthGateState =
        gate.kind === 'linkChain' && lastAction.current
          ? { ...gate, chain: lastAction.current.params.chain }
          : gate;
      setState((s) => ({
        ...s,
        isLoading: false,
        authGate: enriched,
        error: null,
        status: 'authGate',
      }));
      return;
    }
    const msg = err instanceof Error ? err.message : fallback;
    setState((s) => ({ ...s, isLoading: false, error: msg, status: 'error' }));
  };

  const getQuote = useCallback(async (params: QuoteParams) => {
    lastAction.current = { kind: 'quote', params };
    quoteAbortRef.current?.abort();
    const controller = new AbortController();
    quoteAbortRef.current = controller;

    setState((s) => ({
      ...s,
      isLoading: true,
      error: null,
      authGate: null,
      status: 'loading',
    }));
    try {
      const info = await dfxPaymentService.getSellQuote(params, { signal: controller.signal });
      if (quoteAbortRef.current !== controller) return null;
      setSellState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
      return info;
    } catch (err) {
      if (quoteAbortRef.current !== controller) return null;
      handleError(err, 'Quote failed');
      return null;
    }
  }, []);

  const createPaymentInfo = useCallback(async (params: PaymentInfoParams) => {
    lastAction.current = { kind: 'paymentInfo', params };
    const controller = new AbortController();
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null, status: 'loading' }));
    try {
      const info = await dfxPaymentService.createSellPaymentInfo(params, {
        signal: controller.signal,
      });
      setSellState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
      return info;
    } catch (err) {
      handleError(err, 'Failed to create sell order');
      return null;
    }
  }, []);

  const confirmSell = useCallback(async (id: number) => {
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null, status: 'loading' }));
    try {
      await dfxPaymentService.confirmSell(id);
      setState((s) => ({
        ...s,
        isLoading: false,
        status: deriveStatus({ ...s, isLoading: false }),
      }));
      return true;
    } catch (err) {
      handleError(err, 'Confirmation failed');
      return false;
    }
  }, []);

  const dismissAuthGate = useCallback(() => {
    setState((s) => {
      const next = { ...s, authGate: null };
      return { ...next, status: deriveStatus(next) };
    });
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
    quoteAbortRef.current?.abort();
    quoteAbortRef.current = null;
    setState(INITIAL_STATE);
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
