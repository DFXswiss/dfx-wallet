import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChainId } from '@/config/chains';
import { dfxPaymentService, interpretDfxAuthError } from '@/features/dfx-backend/services';
import type { DfxAuthGateState } from '@/features/dfx-backend/services';
import { DfxApiTimeoutError } from '@/features/dfx-backend/services/api';
import type { BuyPaymentInfoDto } from '@/features/dfx-backend/services/dto';

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
type RetryAction = { kind: 'quote' | 'paymentInfo'; params: QuoteParams };

/**
 * Discriminated quote status. `BuyState.status` lets the screen `switch`
 * on a single value instead of juggling four nullable fields. The legacy
 * flat shape (`isLoading`, `paymentInfo`, `error`, `authGate`) is still
 * returned alongside for backwards compatibility with screens that
 * haven't migrated yet.
 *
 * Mirrors the realunit-app `BuyPaymentInfoState` union (Loading / Success /
 * MinAmountNotMetFailure / Failure) but kept additive so we can refactor
 * call sites incrementally.
 */
export type BuyStatus = 'idle' | 'loading' | 'success' | 'invalid' | 'authGate' | 'error';

type BuyState = {
  status: BuyStatus;
  isLoading: boolean;
  paymentInfo: BuyPaymentInfoDto | null;
  error: string | null;
  authGate: DfxAuthGateState | null;
};

const INITIAL_STATE: BuyState = {
  status: 'idle',
  isLoading: false,
  paymentInfo: null,
  error: null,
  authGate: null,
};

/**
 * Derive the discriminated `status` from the underlying flat state.
 * Centralised so consumers and producers can't disagree on what counts
 * as "valid" vs "invalid quote with error code" vs "auth gate".
 */
function deriveStatus(s: Omit<BuyState, 'status'>): BuyStatus {
  if (s.authGate) return 'authGate';
  if (s.error) return 'error';
  if (s.isLoading) return 'loading';
  if (!s.paymentInfo) return 'idle';
  if (s.paymentInfo.isValid) return 'success';
  return 'invalid';
}

/**
 * Hook for the DFX Buy (fiat → crypto) flow.
 *
 * Steps:
 * 1. getQuote() — preview exchange rate and fees
 * 2. createPaymentInfo() — get SEPA bank details + reference code
 * 3. User transfers via bank
 * 4. confirmPayment() — mark as paid
 *
 * Quote calls cancel any in-flight predecessor via AbortController so a
 * fast typist never sees a stale fee number flash in. Mirrors realunit's
 * CancelableOperation pattern.
 */
export function useBuyFlow() {
  const { t } = useTranslation();
  const [state, setState] = useState<BuyState>(INITIAL_STATE);

  const setBuyState = (next: Omit<BuyState, 'status'>) => {
    setState({ ...next, status: deriveStatus(next) });
  };

  // Remember only the call that caused an auth gate so focus changes cannot
  // replay successful or ordinary failed payment requests.
  const lastAction = useRef<RetryAction | null>(null);
  const authGateRef = useRef<DfxAuthGateState | null>(null);
  authGateRef.current = state.authGate;
  // Monotonic id for quote and payment-info calls. A response may change
  // state only while its id is still the latest. reset() and unmount bump
  // it so a late response cannot reopen a gate or rewrite payment info.
  const requestSeqRef = useRef(0);
  // Track the most recent in-flight quote so a newer quote supersedes older
  // ones — older responses are dropped instead of clobbering newer state.
  const quoteAbortRef = useRef<AbortController | null>(null);
  // /paymentInfos commits an order. A newer quote must not abort it; a newer
  // payment-info call, reset(), or unmount does.
  const paymentAbortRef = useRef<AbortController | null>(null);

  const isCurrentRequest = useCallback((seq: number) => seq === requestSeqRef.current, []);

  // Abort any pending call when the hook unmounts so the screen tearing
  // down doesn't leave a dangling fetch that resolves into setState.
  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      quoteAbortRef.current?.abort();
      paymentAbortRef.current?.abort();
    };
  }, []);

  const handleError = useCallback(
    (err: unknown, fallback: string, action?: RetryAction) => {
      // AbortError is expected when a newer quote supersedes an older one;
      // do not flip the screen into an error state for it.
      if (err instanceof Error && err.name === 'AbortError') return;
      const gate = interpretDfxAuthError(err);
      if (gate) {
        lastAction.current = action ?? null;
        // Attach the WDK chain id of the last attempted call so the linkChain
        // gate can sign with the right wallet.
        const enriched: DfxAuthGateState =
          gate.kind === 'linkChain' && action ? { ...gate, chain: action.params.chain } : gate;
        setState((s) => ({
          ...s,
          isLoading: false,
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
      const seq = ++requestSeqRef.current;
      const action: RetryAction = { kind: 'quote', params };
      lastAction.current = null;

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
        const info = await dfxPaymentService.getBuyQuote(params, { signal: controller.signal });
        if (!isCurrentRequest(seq) || quoteAbortRef.current !== controller) return null;
        // Normalise: DFX' BuyQuoteDto returns `errors` as an array; older
        // responses use a singular `error`. Collapse to one field for the
        // screen.
        const firstError = info.errors && info.errors.length > 0 ? info.errors[0] : undefined;
        const normalised = info.error || !firstError ? info : { ...info, error: firstError };
        lastAction.current = null;
        setBuyState({
          isLoading: false,
          paymentInfo: normalised,
          error: null,
          authGate: null,
        });
        return normalised;
      } catch (err) {
        if (!isCurrentRequest(seq) || quoteAbortRef.current !== controller) return null;
        handleError(err, 'Quote failed', action);
        return null;
      }
    },
    [handleError, isCurrentRequest],
  );

  const createPaymentInfo = useCallback(
    async (params: QuoteParams) => {
      const seq = ++requestSeqRef.current;
      const action: RetryAction = { kind: 'paymentInfo', params };
      lastAction.current = null;
      // A newer payment-info call supersedes the previous one. A quote does
      // not: /paymentInfos commits the order, so its controller stays live
      // until this call, reset(), or unmount replaces it.
      paymentAbortRef.current?.abort();
      const controller = new AbortController();
      paymentAbortRef.current = controller;
      setState((s) => ({ ...s, isLoading: true, error: null, authGate: null, status: 'loading' }));
      try {
        const info = await dfxPaymentService.createBuyPaymentInfo(params, {
          signal: controller.signal,
        });
        if (!isCurrentRequest(seq) || paymentAbortRef.current !== controller) return null;
        lastAction.current = null;
        setBuyState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
        return info;
      } catch (err) {
        if (!isCurrentRequest(seq) || paymentAbortRef.current !== controller) return null;
        handleError(err, 'Failed to create payment info', action);
        return null;
      }
    },
    [handleError, isCurrentRequest],
  );

  const confirmPayment = useCallback(
    async (id: number) => {
      setState((s) => ({ ...s, isLoading: true, error: null, authGate: null, status: 'loading' }));
      try {
        await dfxPaymentService.confirmBuy(id);
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

  /**
   * Re-run the call that triggered the auth gate. Wired into the gate's
   * onAuthenticated callback so a successful sign-in transparently advances
   * the flow without forcing the user to type their amount in again.
   */
  const retryLast = useCallback(async () => {
    const last = lastAction.current;
    if (!last) return null;
    if (last.kind === 'quote') {
      return { kind: 'quote' as const, info: await getQuote(last.params) };
    }
    return { kind: 'paymentInfo' as const, info: await createPaymentInfo(last.params) };
  }, [getQuote, createPaymentInfo]);

  const reset = useCallback(() => {
    requestSeqRef.current += 1;
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
    confirmPayment,
    dismissAuthGate,
    cancelAuthGate,
    retryLast,
    reset,
  };
}

// Backwards-compatible alias — useful for screens that want the legacy
// flat shape without TypeScript complaining about the new `status` key.
export type UseBuyFlowReturn = ReturnType<typeof useBuyFlow>;
