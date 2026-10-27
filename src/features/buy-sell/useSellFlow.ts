import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChainId } from '@/config/chains';
import { dfxPaymentService, interpretDfxAuthError } from '@/features/dfx-backend/services';
import type { DfxAuthGateState } from '@/features/dfx-backend/services';
import { DfxApiTimeoutError } from '@/features/dfx-backend/services/api';
import type { SellPaymentInfoDto } from '@/features/dfx-backend/services/dto';

type QuoteParams = {
  amount: number;
  asset: string;
  blockchain: string;
  currency: string;
  chain: ChainId;
};
type PaymentInfoParams = QuoteParams & { iban: string };
type RetryAction =
  | { kind: 'quote'; params: QuoteParams }
  | { kind: 'paymentInfo'; params: PaymentInfoParams };

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
  const { t } = useTranslation();
  const [state, setState] = useState<SellState>(INITIAL_STATE);

  const setSellState = (next: Omit<SellState, 'status'>) => {
    setState({ ...next, status: deriveStatus(next) });
  };

  // Remember only the call that caused an auth gate so focus changes cannot
  // replay successful or ordinary failed payment requests.
  const lastAction = useRef<RetryAction | null>(null);
  const authGateRef = useRef<DfxAuthGateState | null>(null);
  authGateRef.current = state.authGate;
  // Quote and payment-info calls have separate ids. getQuote bumps only the
  // quote id, so it cannot drop a payment response. createPaymentInfo bumps
  // both, so a late quote cannot replace the deposit this call commits.
  // reset() and unmount bump both, so a late response cannot reopen a gate.
  const quoteSeqRef = useRef(0);
  const paymentSeqRef = useRef(0);
  // Published when a payment-info call applies order details. A quote that
  // started while that call was in flight still owns the latest quote id, so
  // the id alone cannot stop it from overwriting the deposit address.
  const committedPaymentSeqRef = useRef(0);
  const quoteAbortRef = useRef<AbortController | null>(null);
  // /paymentInfos commits an order. A newer quote must not abort it; a newer
  // payment-info call, reset(), or unmount does.
  const paymentAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      quoteSeqRef.current += 1;
      paymentSeqRef.current += 1;
      quoteAbortRef.current?.abort();
      paymentAbortRef.current?.abort();
    };
  }, []);

  const handleError = useCallback(
    (err: unknown, fallback: string, action?: RetryAction) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      const gate = interpretDfxAuthError(err);
      if (gate) {
        lastAction.current = action ?? null;
        const enriched: DfxAuthGateState =
          gate.kind === 'linkChain' && action ? { ...gate, chain: action.params.chain } : gate;
        setState((s) => ({
          ...s,
          isLoading: false,
          // A dismissed or cancelled gate must not fall back to an earlier
          // order. deriveStatus would report that leftover deposit as success.
          paymentInfo: null,
          authGate: enriched,
          error: null,
          status: 'authGate',
        }));
        return;
      }
      lastAction.current = null;
      const msg =
        err instanceof DfxApiTimeoutError
          ? t('common.requestTimeout')
          : err instanceof Error
            ? err.message
            : fallback;
      setState((s) => ({ ...s, isLoading: false, error: msg, status: 'error' }));
    },
    [t],
  );

  const getQuote = useCallback(
    async (params: QuoteParams) => {
      const quoteSeq = ++quoteSeqRef.current;
      const committedAtStart = committedPaymentSeqRef.current;
      const action: RetryAction = { kind: 'quote', params };
      lastAction.current = null;
      const quoteApplies = () =>
        quoteSeq === quoteSeqRef.current && committedPaymentSeqRef.current === committedAtStart;
      // Cancel any predecessor quote. Do not abort an in-flight payment
      // info: that request commits an order on the server.
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
        if (!quoteApplies() || quoteAbortRef.current !== controller) return null;
        lastAction.current = null;
        setSellState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
        return info;
      } catch (err) {
        if (!quoteApplies() || quoteAbortRef.current !== controller) return null;
        handleError(err, 'Quote failed', action);
        return null;
      }
    },
    [handleError],
  );

  const createPaymentInfo = useCallback(
    async (params: PaymentInfoParams) => {
      quoteSeqRef.current += 1;
      const paymentSeq = ++paymentSeqRef.current;
      const action: RetryAction = { kind: 'paymentInfo', params };
      lastAction.current = null;
      // A newer payment-info call supersedes the previous one. A quote does
      // not: /paymentInfos commits the order, so its controller stays live
      // until this call, reset(), or unmount replaces it.
      paymentAbortRef.current?.abort();
      const controller = new AbortController();
      paymentAbortRef.current = controller;
      const paymentApplies = () =>
        paymentSeq === paymentSeqRef.current && paymentAbortRef.current === controller;
      setState((s) => ({ ...s, isLoading: true, error: null, authGate: null, status: 'loading' }));
      try {
        const info = await dfxPaymentService.createSellPaymentInfo(params, {
          signal: controller.signal,
        });
        if (!paymentApplies()) return null;
        committedPaymentSeqRef.current = paymentSeq;
        lastAction.current = null;
        setSellState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
        return info;
      } catch (err) {
        if (!paymentApplies()) return null;
        handleError(err, 'Failed to create sell order', action);
        return null;
      }
    },
    [handleError],
  );

  const confirmSell = useCallback(
    async (id: number) => {
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
    },
    [handleError],
  );

  const hideAuthGate = useCallback((gate?: DfxAuthGateState) => {
    if (gate !== undefined && authGateRef.current !== gate) return;
    authGateRef.current = null;
    setState((s) => {
      if (gate !== undefined && s.authGate !== gate) return s;
      const next = { ...s, authGate: null };
      return { ...next, status: deriveStatus(next) };
    });
  }, []);

  // Proceeding through the gate hides it and keeps the failed call so a
  // later focus or chain link can replay it.
  const dismissAuthGate = useCallback(
    (gate?: DfxAuthGateState) => {
      hideAuthGate(gate);
    },
    [hideAuthGate],
  );

  // Cancel drops the failed call. A later focus or link must not replay it.
  const cancelAuthGate = useCallback(
    (gate?: DfxAuthGateState) => {
      if (gate !== undefined && authGateRef.current !== gate) return;
      lastAction.current = null;
      hideAuthGate(gate);
    },
    [hideAuthGate],
  );

  const retryLast = useCallback(async () => {
    const last = lastAction.current;
    if (!last) return null;
    if (last.kind === 'quote') {
      return { kind: 'quote' as const, info: await getQuote(last.params) };
    }
    return { kind: 'paymentInfo' as const, info: await createPaymentInfo(last.params) };
  }, [getQuote, createPaymentInfo]);

  const reset = useCallback(() => {
    quoteSeqRef.current += 1;
    paymentSeqRef.current += 1;
    committedPaymentSeqRef.current = 0;
    lastAction.current = null;
    quoteAbortRef.current?.abort();
    quoteAbortRef.current = null;
    paymentAbortRef.current?.abort();
    paymentAbortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    getQuote,
    createPaymentInfo,
    confirmSell,
    dismissAuthGate,
    cancelAuthGate,
    retryLast,
    reset,
  };
}
