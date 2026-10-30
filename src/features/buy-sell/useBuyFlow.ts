import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChainId } from '@/config/chains';
import { dfxPaymentService, interpretDfxAuthError } from '@/features/dfx-backend/services';
import type { DfxAuthGateState } from '@/features/dfx-backend/services';
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
  const [state, setState] = useState<BuyState>(INITIAL_STATE);

  const setBuyState = (next: Omit<BuyState, 'status'>) => {
    setState({ ...next, status: deriveStatus(next) });
  };

  // Remember the last attempted call so we can replay it after the user
  // clears the auth gate via the sign-in modal.
  const lastAction = useRef<{ kind: 'quote' | 'paymentInfo'; params: QuoteParams } | null>(null);
  // Track the most recent in-flight quote so a newer request supersedes
  // older ones — older responses are dropped instead of clobbering the
  // newer state.
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Abort any pending quote when the hook unmounts so the screen tearing
  // down doesn't leave a dangling fetch that resolves into setState on a
  // stale component.
  useEffect(() => {
    return () => {
      quoteAbortRef.current?.abort();
    };
  }, []);

  const handleError = (err: unknown, fallback: string) => {
    // AbortError is expected when a newer quote supersedes an older one;
    // do not flip the screen into an error state for it.
    if (err instanceof Error && err.name === 'AbortError') return;
    const gate = interpretDfxAuthError(err);
    if (gate) {
      // Attach the WDK chain id of the last attempted call so the linkChain
      // gate can sign with the right wallet.
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

    // Cancel any predecessor and start a fresh window.
    quoteAbortRef.current?.abort();
    const controller = new AbortController();
    quoteAbortRef.current = controller;

    setState((s) => ({
      ...s,
      isLoading: true,
      error: null,
      authGate: null,
      status: s.paymentInfo ? 'loading' : 'loading',
    }));
    try {
      const info = await dfxPaymentService.getBuyQuote(params, { signal: controller.signal });
      // If we were superseded between the await and now, the abort signal
      // would already have triggered — but double-check via ref identity.
      if (quoteAbortRef.current !== controller) return null;
      // Normalise: DFX' BuyQuoteDto returns `errors` as an array; older
      // responses use a singular `error`. Collapse to one field for the
      // screen.
      const firstError = info.errors && info.errors.length > 0 ? info.errors[0] : undefined;
      const normalised = info.error || !firstError ? info : { ...info, error: firstError };
      setBuyState({
        isLoading: false,
        paymentInfo: normalised,
        error: null,
        authGate: null,
      });
      return normalised;
    } catch (err) {
      if (quoteAbortRef.current !== controller) return null;
      handleError(err, 'Quote failed');
      return null;
    }
  }, []);

  const createPaymentInfo = useCallback(async (params: QuoteParams) => {
    lastAction.current = { kind: 'paymentInfo', params };
    // /paymentInfos commits the order — we do NOT want a previous quote
    // race to cancel it. Use its own controller, scoped just to this call.
    const controller = new AbortController();
    setState((s) => ({ ...s, isLoading: true, error: null, authGate: null, status: 'loading' }));
    try {
      const info = await dfxPaymentService.createBuyPaymentInfo(params, {
        signal: controller.signal,
      });
      setBuyState({ isLoading: false, paymentInfo: info, error: null, authGate: null });
      return info;
    } catch (err) {
      handleError(err, 'Failed to create payment info');
      return null;
    }
  }, []);

  const confirmPayment = useCallback(async (id: number) => {
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
  }, []);

  const dismissAuthGate = useCallback(() => {
    setState((s) => {
      const next = { ...s, authGate: null };
      return { ...next, status: deriveStatus(next) };
    });
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
    quoteAbortRef.current?.abort();
    quoteAbortRef.current = null;
    setState(INITIAL_STATE);
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

// Backwards-compatible alias — useful for screens that want the legacy
// flat shape without TypeScript complaining about the new `status` key.
export type UseBuyFlowReturn = ReturnType<typeof useBuyFlow>;
