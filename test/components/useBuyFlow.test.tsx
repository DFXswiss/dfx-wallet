import { renderHook, act } from '@testing-library/react-native';
import { DfxApiTimeoutError } from '@/features/dfx-backend/services/api';
import type { BuyPaymentInfoDto } from '../../src/features/dfx-backend/services/dto';

// Mock the DFX service barrel the hook imports from. We drive every branch
// of the hook's state machine through these two seams and assert on the
// observable state transitions, never on private hook internals.
const mockGetBuyQuote = jest.fn();
const mockCreateBuyPaymentInfo = jest.fn();
const mockConfirmBuy = jest.fn();
const mockInterpretDfxAuthError = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxPaymentService: {
    getBuyQuote: (...args: unknown[]) => mockGetBuyQuote(...args),
    createBuyPaymentInfo: (...args: unknown[]) => mockCreateBuyPaymentInfo(...args),
    confirmBuy: (...args: unknown[]) => mockConfirmBuy(...args),
  },
  interpretDfxAuthError: (...args: unknown[]) => mockInterpretDfxAuthError(...args),
}));

import { useBuyFlow } from '../../src/features/buy-sell/useBuyFlow';

const QUOTE = {
  amount: 100,
  currency: 'EUR',
  asset: 'BTC',
  blockchain: 'Bitcoin',
  chain: 'bitcoin' as const,
};

function validInfo(overrides: Partial<BuyPaymentInfoDto> = {}): BuyPaymentInfoDto {
  return { id: 1, isValid: true, ...overrides } as unknown as BuyPaymentInfoDto;
}

/** A promise plus its resolve/reject handles, for race / stale-response tests. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockGetBuyQuote.mockReset();
  mockCreateBuyPaymentInfo.mockReset();
  mockConfirmBuy.mockReset();
  mockInterpretDfxAuthError.mockReset();
  mockInterpretDfxAuthError.mockReturnValue(null);
});

describe('useBuyFlow', () => {
  it('starts idle with no payment info, error, or auth gate', () => {
    const { result } = renderHook(() => useBuyFlow());
    expect(result.current.status).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.authGate).toBeNull();
  });

  it('stores a valid quote and derives success', async () => {
    mockGetBuyQuote.mockResolvedValueOnce(validInfo());
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 1, isValid: true });
    expect(result.current.error).toBeNull();
    expect(result.current.authGate).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('normalises errors[0] into paymentInfo.error and derives invalid', async () => {
    mockGetBuyQuote.mockResolvedValueOnce(validInfo({ isValid: false, errors: ['AmountTooLow'] }));
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.status).toBe('invalid');
    expect(result.current.paymentInfo?.error).toBe('AmountTooLow');
  });

  it('aborts the previous quote signal but keeps the newer request live', async () => {
    const first = deferred<BuyPaymentInfoDto>();
    const second = deferred<BuyPaymentInfoDto>();
    mockGetBuyQuote.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useBuyFlow());

    let firstCall: Promise<unknown>;
    act(() => {
      firstCall = result.current.getQuote(QUOTE);
    });
    act(() => {
      void result.current.getQuote({ ...QUOTE, amount: 200 });
    });

    const firstSignal = mockGetBuyQuote.mock.calls[0]![1].signal as AbortSignal;
    const secondSignal = mockGetBuyQuote.mock.calls[1]![1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    // Drain the still-pending first promise so it cannot leak across tests.
    await act(async () => {
      first.resolve(validInfo());
      await firstCall;
    });
  });

  it('drops a stale first response that resolves after a newer quote', async () => {
    const first = deferred<BuyPaymentInfoDto>();
    const second = deferred<BuyPaymentInfoDto>();
    mockGetBuyQuote.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useBuyFlow());

    let firstCall: Promise<unknown>;
    act(() => {
      firstCall = result.current.getQuote(QUOTE);
    });
    let secondCall: Promise<unknown>;
    act(() => {
      secondCall = result.current.getQuote({ ...QUOTE, amount: 200 });
    });

    // Newer quote settles first with id 2, then the stale first resolves.
    await act(async () => {
      second.resolve(validInfo({ id: 2 }));
      await secondCall;
    });
    await act(async () => {
      first.resolve(validInfo({ id: 1 }));
      await firstCall;
    });

    expect(result.current.paymentInfo?.id).toBe(2);
  });

  it('surfaces a non-abort service error as status error', async () => {
    mockGetBuyQuote.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('network down');
    expect(result.current.isLoading).toBe(false);
  });

  it('translates a DFX API timeout instead of exposing its raw message', async () => {
    const timeout = new DfxApiTimeoutError(15_000);
    mockGetBuyQuote.mockRejectedValueOnce(timeout);
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('common.requestTimeout');
    expect(result.current.error).not.toBe(timeout.message);
  });

  it('does not enter error state when the quote is aborted', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    mockGetBuyQuote.mockRejectedValueOnce(abortErr);
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.status).not.toBe('error');
    expect(result.current.error).toBeNull();
  });

  it('maps a quote auth error to an auth gate and clears ordinary errors', async () => {
    mockGetBuyQuote.mockRejectedValueOnce(new Error('login'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'login', message: 'sign in' });
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.status).toBe('authGate');
    expect(result.current.authGate).toMatchObject({ kind: 'login' });
    expect(result.current.error).toBeNull();
  });

  it('enriches a linkChain gate with the attempted chain', async () => {
    mockGetBuyQuote.mockRejectedValueOnce(new Error('asset blockchain mismatch'));
    mockInterpretDfxAuthError.mockReturnValueOnce({
      kind: 'linkChain',
      message: 'link it',
    });
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.authGate).toMatchObject({ kind: 'linkChain', chain: 'bitcoin' });
  });

  it('drops payment info when an auth error is dismissed', async () => {
    // An earlier quote succeeded. The payment-info auth error must not leave
    // that IBAN in place, or dismiss turns it back into success.
    mockGetBuyQuote.mockResolvedValueOnce(validInfo({ id: 7 }));
    mockCreateBuyPaymentInfo.mockRejectedValueOnce(new Error('kyc'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'kyc', message: 'finish kyc' });

    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });
    expect(result.current.status).toBe('success');

    await act(async () => {
      await result.current.createPaymentInfo(QUOTE);
    });
    expect(result.current.status).toBe('authGate');
    expect(result.current.paymentInfo).toBeNull();

    act(() => {
      result.current.dismissAuthGate();
    });

    expect(result.current.authGate).toBeNull();
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.status).not.toBe('success');
  });

  it('dismisses only the identified auth gate while preserving no-argument behavior', async () => {
    const staleGate = { kind: 'kyc' as const, message: 'finish KYC' };
    const currentGate = { kind: 'login' as const, message: 'sign in' };
    const noArgumentGate = { kind: 'registration' as const, message: 'register' };
    mockGetBuyQuote
      .mockRejectedValueOnce(new Error('kyc'))
      .mockRejectedValueOnce(new Error('login'))
      .mockRejectedValueOnce(new Error('registration'));
    mockInterpretDfxAuthError
      .mockReturnValueOnce(staleGate)
      .mockReturnValueOnce(currentGate)
      .mockReturnValueOnce(noArgumentGate);
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });
    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    act(() => {
      result.current.dismissAuthGate(staleGate);
    });
    expect(result.current.authGate).toBe(currentGate);
    expect(result.current.status).toBe('authGate');

    act(() => {
      result.current.dismissAuthGate(currentGate);
    });
    expect(result.current.authGate).toBeNull();
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });
    act(() => {
      result.current.dismissAuthGate();
    });
    expect(result.current.authGate).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('retryLast replays the last quote with the original params', async () => {
    mockGetBuyQuote.mockRejectedValueOnce(new Error('login'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'login', message: 'sign in' });
    mockGetBuyQuote.mockResolvedValueOnce(validInfo());

    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });
    expect(result.current.status).toBe('authGate');

    let retryResult: {
      kind: 'quote' | 'paymentInfo';
      info: BuyPaymentInfoDto | null;
    } | null = null;
    await act(async () => {
      retryResult = await result.current.retryLast();
    });

    expect(mockGetBuyQuote).toHaveBeenCalledTimes(2);
    expect(mockGetBuyQuote.mock.calls[1]![0]).toEqual(QUOTE);
    expect(retryResult).toMatchObject({
      kind: 'quote',
      info: { id: 1, isValid: true },
    });
    expect(result.current.status).toBe('success');
  });

  it('retryLast replays a createPaymentInfo action when that was the last call', async () => {
    mockCreateBuyPaymentInfo.mockRejectedValueOnce(new Error('login'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'login', message: 'sign in' });
    mockCreateBuyPaymentInfo.mockResolvedValueOnce(validInfo());

    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.createPaymentInfo(QUOTE);
    });
    let retryResult: {
      kind: 'quote' | 'paymentInfo';
      info: BuyPaymentInfoDto | null;
    } | null = null;
    await act(async () => {
      retryResult = await result.current.retryLast();
    });

    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockGetBuyQuote).not.toHaveBeenCalled();
    expect(retryResult).toMatchObject({
      kind: 'paymentInfo',
      info: { id: 1, isValid: true },
    });
  });

  it('retryLast returns null after a successful createPaymentInfo', async () => {
    mockCreateBuyPaymentInfo.mockResolvedValueOnce(validInfo());
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.createPaymentInfo(QUOTE);
    });

    let retryResult: Awaited<ReturnType<typeof result.current.retryLast>> = null;
    await act(async () => {
      retryResult = await result.current.retryLast();
    });

    expect(retryResult).toBeNull();
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('does not expose a payment-info retry before an auth failure occurs', async () => {
    const pending = deferred<BuyPaymentInfoDto>();
    mockCreateBuyPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useBuyFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo(QUOTE);
    });
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(validInfo());
      await paymentCall;
    });
  });

  it('does not replay payment info after a non-authentication failure', async () => {
    mockCreateBuyPaymentInfo.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.createPaymentInfo(QUOTE);
    });
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });

    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('confirmPayment returns true and clears loading on success', async () => {
    mockConfirmBuy.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useBuyFlow());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirmPayment(4001);
    });

    expect(ok).toBe(true);
    expect(mockConfirmBuy).toHaveBeenCalledWith(4001);
    expect(result.current.isLoading).toBe(false);
  });

  it('confirmPayment returns false, exposes the error, and clears loading on failure', async () => {
    mockConfirmBuy.mockRejectedValueOnce(new Error('confirm boom'));
    const { result } = renderHook(() => useBuyFlow());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirmPayment(4001);
    });

    expect(ok).toBe(false);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('confirm boom');
    expect(result.current.isLoading).toBe(false);
  });

  it('reset aborts an in-flight quote and returns to the initial state', async () => {
    const pending = deferred<BuyPaymentInfoDto>();
    mockGetBuyQuote.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useBuyFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.getQuote(QUOTE);
    });
    const signal = mockGetBuyQuote.mock.calls[0]![1].signal as AbortSignal;

    act(() => {
      result.current.reset();
    });

    expect(signal.aborted).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.authGate).toBeNull();

    await act(async () => {
      pending.resolve(validInfo());
      await call;
    });
    // The stale resolution must not revive state after reset.
    expect(result.current.status).toBe('idle');
  });

  it('applies a payment-info auth error after a newer quote succeeds', async () => {
    const stale = { ...QUOTE, amount: 50 };
    const fresh = { ...QUOTE, amount: 500 };
    const authErr = new Error('401');
    const pending = deferred<BuyPaymentInfoDto>();
    mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
      err === authErr ? { kind: 'linkChain', message: 'link' } : null,
    );
    mockCreateBuyPaymentInfo.mockReturnValueOnce(pending.promise);
    mockGetBuyQuote.mockResolvedValueOnce(validInfo({ id: 500 }));
    const { result } = renderHook(() => useBuyFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo(stale);
    });
    const paymentSignal = mockCreateBuyPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    await act(async () => {
      await result.current.getQuote(fresh);
    });

    expect(paymentSignal.aborted).toBe(false);
    expect(result.current.paymentInfo).toMatchObject({ id: 500 });
    expect(result.current.authGate).toBeNull();
    expect(result.current.status).toBe('success');

    await act(async () => {
      pending.reject(authErr);
      await paymentCall;
    });

    expect(result.current.authGate).toMatchObject({ kind: 'linkChain', chain: 'bitcoin' });
    expect(result.current.error).toBeNull();
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.status).toBe('authGate');
    mockCreateBuyPaymentInfo.mockResolvedValueOnce(validInfo({ id: 51, iban: 'CH-REPLAY' }));
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toMatchObject({
        kind: 'paymentInfo',
        info: { id: 51, iban: 'CH-REPLAY' },
      });
    });
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockCreateBuyPaymentInfo.mock.calls[0]![0]).toMatchObject({ amount: 50 });
    expect(mockGetBuyQuote).toHaveBeenCalledTimes(1);
  });

  it('applies a late non-auth payment error while a newer quote gate is open', async () => {
    const pending = deferred<BuyPaymentInfoDto>();
    const quoteAuth = new Error('login');
    mockCreateBuyPaymentInfo.mockReturnValueOnce(pending.promise);
    mockGetBuyQuote.mockRejectedValueOnce(quoteAuth);
    mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
      err === quoteAuth ? { kind: 'login', message: 'sign in' } : null,
    );
    const { result } = renderHook(() => useBuyFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo({ ...QUOTE, amount: 50 });
    });

    await act(async () => {
      await result.current.getQuote({ ...QUOTE, amount: 500 });
    });
    expect(result.current.status).toBe('authGate');
    expect(result.current.authGate).toMatchObject({ kind: 'login' });

    await act(async () => {
      pending.reject(new Error('network down'));
      await paymentCall;
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('network down');
    // The non-auth branch keeps the previous gate object. It does not keep
    // the quote as the call to replay.
    expect(result.current.authGate).toMatchObject({ kind: 'login' });

    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
    expect(mockGetBuyQuote).toHaveBeenCalledTimes(1);
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('ignores a late quote after payment info was created', async () => {
    const quotePending = deferred<BuyPaymentInfoDto>();
    mockGetBuyQuote.mockReturnValueOnce(quotePending.promise);
    mockCreateBuyPaymentInfo.mockResolvedValueOnce(validInfo({ id: 9, iban: 'CH-COMMITTED' }));
    const { result } = renderHook(() => useBuyFlow());

    let quoteCall: Promise<unknown>;
    act(() => {
      quoteCall = result.current.getQuote(QUOTE);
    });
    const quoteSignal = mockGetBuyQuote.mock.calls[0]![1].signal as AbortSignal;

    await act(async () => {
      await result.current.createPaymentInfo(QUOTE);
    });

    expect(quoteSignal.aborted).toBe(false);
    expect(result.current.paymentInfo).toMatchObject({ id: 9, iban: 'CH-COMMITTED' });

    await act(async () => {
      quotePending.resolve(validInfo({ id: 1, iban: 'CH-STALE' }));
      await quoteCall;
    });

    expect(result.current.paymentInfo).toMatchObject({ id: 9, iban: 'CH-COMMITTED' });
    expect(result.current.status).toBe('success');
  });

  it('applies payment info started before a quote and ignores that late quote', async () => {
    const paymentPending = deferred<BuyPaymentInfoDto>();
    const quotePending = deferred<BuyPaymentInfoDto>();
    mockCreateBuyPaymentInfo.mockReturnValueOnce(paymentPending.promise);
    mockGetBuyQuote.mockReturnValueOnce(quotePending.promise);
    const { result } = renderHook(() => useBuyFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo(QUOTE);
    });
    const paymentSignal = mockCreateBuyPaymentInfo.mock.calls[0]![1].signal as AbortSignal;
    let quoteCall: Promise<unknown>;
    act(() => {
      quoteCall = result.current.getQuote({ ...QUOTE, amount: 500 });
    });

    expect(paymentSignal.aborted).toBe(false);

    await act(async () => {
      paymentPending.resolve(validInfo({ id: 9, iban: 'CH-COMMITTED' }));
      await paymentCall;
    });
    expect(result.current.paymentInfo).toMatchObject({ id: 9, iban: 'CH-COMMITTED' });
    expect(result.current.status).toBe('success');

    await act(async () => {
      quotePending.resolve(validInfo({ id: 1, iban: 'CH-QUOTE' }));
      await quoteCall;
    });
    expect(result.current.paymentInfo).toMatchObject({ id: 9, iban: 'CH-COMMITTED' });
    expect(result.current.status).toBe('success');
  });

  it('keeps the newer payment info when an older call resolves last', async () => {
    const first = deferred<BuyPaymentInfoDto>();
    const second = deferred<BuyPaymentInfoDto>();
    mockCreateBuyPaymentInfo
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useBuyFlow());

    let firstCall: Promise<unknown>;
    act(() => {
      firstCall = result.current.createPaymentInfo({ ...QUOTE, amount: 50 });
    });
    let secondCall: Promise<unknown>;
    act(() => {
      secondCall = result.current.createPaymentInfo({ ...QUOTE, amount: 500 });
    });

    const firstSignal = mockCreateBuyPaymentInfo.mock.calls[0]![1].signal as AbortSignal;
    const secondSignal = mockCreateBuyPaymentInfo.mock.calls[1]![1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    await act(async () => {
      second.resolve(validInfo({ id: 2, iban: 'CH-NEWER' }));
      await secondCall;
    });
    expect(result.current.paymentInfo).toMatchObject({ id: 2, iban: 'CH-NEWER' });

    await act(async () => {
      first.resolve(validInfo({ id: 1, iban: 'CH-OLDER' }));
      await firstCall;
    });
    expect(result.current.paymentInfo).toMatchObject({ id: 2, iban: 'CH-NEWER' });
    expect(result.current.status).toBe('success');
  });

  it('ignores a payment-info response after reset and aborts its signal', async () => {
    const pending = deferred<BuyPaymentInfoDto>();
    mockCreateBuyPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useBuyFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(QUOTE);
    });
    const signal = mockCreateBuyPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    act(() => {
      result.current.reset();
    });

    expect(signal.aborted).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.paymentInfo).toBeNull();

    await act(async () => {
      pending.resolve(validInfo({ id: 9, iban: 'CH-LATE' }));
      await call;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.authGate).toBeNull();
  });

  it('aborts an in-flight payment info when the hook unmounts', async () => {
    const pending = deferred<BuyPaymentInfoDto>();
    mockCreateBuyPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useBuyFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(QUOTE);
    });
    const signal = mockCreateBuyPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    unmount();
    expect(signal.aborted).toBe(true);

    await act(async () => {
      pending.resolve(validInfo({ id: 9 }));
      await call;
    });
  });

  it('replays after dismissAuthGate and replays nothing after cancelAuthGate', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    const other = { kind: 'kyc' as const, message: 'finish KYC' };
    mockCreateBuyPaymentInfo
      .mockRejectedValueOnce(new Error('login'))
      .mockResolvedValueOnce(validInfo({ id: 4 }))
      .mockRejectedValueOnce(new Error('login'));
    mockInterpretDfxAuthError.mockReturnValueOnce(gate).mockReturnValueOnce(gate);
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.createPaymentInfo({ ...QUOTE, amount: 50 });
    });
    expect(result.current.authGate).toEqual(gate);

    act(() => {
      result.current.dismissAuthGate(other);
      result.current.cancelAuthGate(other);
    });
    expect(result.current.authGate).toEqual(gate);

    act(() => {
      result.current.dismissAuthGate(gate);
    });
    expect(result.current.authGate).toBeNull();

    await act(async () => {
      await result.current.retryLast();
    });
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockCreateBuyPaymentInfo.mock.calls[1]![0]).toMatchObject({ amount: 50 });
    expect(result.current.status).toBe('success');

    await act(async () => {
      await result.current.createPaymentInfo({ ...QUOTE, amount: 75 });
    });
    expect(result.current.authGate).toEqual(gate);

    act(() => {
      result.current.cancelAuthGate(gate);
    });
    expect(result.current.authGate).toBeNull();

    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(3);
  });

  it('keeps payment info when confirm fails with an auth error', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    mockCreateBuyPaymentInfo.mockResolvedValueOnce(validInfo({ id: 8, iban: 'CH-KEEP' }));
    mockConfirmBuy.mockRejectedValueOnce(new Error('401'));
    mockInterpretDfxAuthError.mockReturnValueOnce(gate);
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.createPaymentInfo(QUOTE);
    });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirmPayment(8);
    });

    expect(ok).toBe(false);
    expect(result.current.paymentInfo).toMatchObject({ id: 8, iban: 'CH-KEEP' });
    expect(result.current.authGate).toEqual(gate);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores a confirm that settles after reset', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    const rejected = deferred<void>();
    const resolved = deferred<void>();
    mockConfirmBuy.mockReturnValueOnce(rejected.promise).mockReturnValueOnce(resolved.promise);
    mockInterpretDfxAuthError.mockReturnValue(gate);

    const rejectedHook = renderHook(() => useBuyFlow());
    let rejectedCall: Promise<boolean>;
    act(() => {
      rejectedCall = rejectedHook.result.current.confirmPayment(1);
    });
    act(() => {
      rejectedHook.result.current.reset();
    });
    let rejectedOk: boolean | undefined;
    await act(async () => {
      rejected.reject(new Error('401'));
      rejectedOk = await rejectedCall;
    });

    expect(rejectedOk).toBe(false);
    expect(rejectedHook.result.current.status).toBe('idle');
    expect(rejectedHook.result.current.paymentInfo).toBeNull();
    expect(rejectedHook.result.current.authGate).toBeNull();
    expect(rejectedHook.result.current.error).toBeNull();
    expect(rejectedHook.result.current.isLoading).toBe(false);
    rejectedHook.unmount();

    const resolvedHook = renderHook(() => useBuyFlow());
    let resolvedCall: Promise<boolean>;
    act(() => {
      resolvedCall = resolvedHook.result.current.confirmPayment(2);
    });
    act(() => {
      resolvedHook.result.current.reset();
    });
    let resolvedOk: boolean | undefined;
    await act(async () => {
      resolved.resolve();
      resolvedOk = await resolvedCall;
    });

    expect(resolvedOk).toBe(false);
    expect(resolvedHook.result.current.status).toBe('idle');
    expect(resolvedHook.result.current.paymentInfo).toBeNull();
    expect(resolvedHook.result.current.authGate).toBeNull();
    expect(resolvedHook.result.current.error).toBeNull();
    expect(resolvedHook.result.current.isLoading).toBe(false);
    resolvedHook.unmount();
  });

  it('keeps the later confirm when an earlier confirm fails afterwards', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    mockConfirmBuy.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useBuyFlow());

    let firstCall!: Promise<boolean>;
    let secondCall!: Promise<boolean>;
    act(() => {
      firstCall = result.current.confirmPayment(1);
    });
    act(() => {
      secondCall = result.current.confirmPayment(2);
    });

    let secondOk: boolean | undefined;
    await act(async () => {
      second.resolve();
      secondOk = await secondCall;
    });
    let firstOk: boolean | undefined;
    await act(async () => {
      first.reject(new Error('confirm boom'));
      firstOk = await firstCall;
    });

    expect(secondOk).toBe(true);
    expect(firstOk).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.authGate).toBeNull();
  });

  it('drops a late quote after cancelAuthGate', async () => {
    const cases = [{ outcome: 'auth' as const }, { outcome: 'ok' as const }];

    for (const { outcome } of cases) {
      mockGetBuyQuote.mockReset();
      mockInterpretDfxAuthError.mockReset();
      const gate = { kind: 'login' as const, message: 'sign in' };
      const authErr = new Error('401');
      mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
        err === authErr ? gate : null,
      );
      const pending = deferred<BuyPaymentInfoDto>();
      mockGetBuyQuote.mockReturnValueOnce(pending.promise);
      const { result, unmount } = renderHook(() => useBuyFlow());

      let call: Promise<unknown>;
      act(() => {
        call = result.current.getQuote(QUOTE);
      });
      const signal = mockGetBuyQuote.mock.calls[0]![1].signal as AbortSignal;

      act(() => {
        result.current.cancelAuthGate();
      });
      expect(signal.aborted).toBe(true);

      await act(async () => {
        if (outcome === 'auth') pending.reject(authErr);
        else pending.resolve(validInfo({ id: 77, iban: 'CH-LATE' }));
        await call;
      });

      expect(result.current.authGate).toBeNull();
      expect(result.current.paymentInfo).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      const callsBeforeRetry = mockGetBuyQuote.mock.calls.length;
      await act(async () => {
        await expect(result.current.retryLast()).resolves.toBeNull();
      });
      expect(mockGetBuyQuote.mock.calls.length).toBe(callsBeforeRetry);
      unmount();
    }
  });

  it('applies payment info that resolves after cancelAuthGate', async () => {
    const pending = deferred<BuyPaymentInfoDto>();
    mockCreateBuyPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useBuyFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(QUOTE);
    });
    const signal = mockCreateBuyPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    act(() => {
      result.current.cancelAuthGate();
    });
    expect(signal.aborted).toBe(false);

    await act(async () => {
      pending.resolve(validInfo({ id: 77, iban: 'CH-LATE' }));
      await call;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 77, iban: 'CH-LATE' });
    expect(result.current.authGate).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
  });

  it('does not reopen the auth gate when payment info fails auth after cancelAuthGate', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    const authErr = new Error('401');
    const pending = deferred<BuyPaymentInfoDto>();
    mockCreateBuyPaymentInfo.mockReturnValueOnce(pending.promise);
    mockInterpretDfxAuthError.mockImplementation((err: unknown) => (err === authErr ? gate : null));
    const { result } = renderHook(() => useBuyFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(QUOTE);
    });
    const signal = mockCreateBuyPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    act(() => {
      result.current.cancelAuthGate();
    });
    expect(signal.aborted).toBe(false);

    await act(async () => {
      pending.reject(authErr);
      await call;
    });

    expect(mockInterpretDfxAuthError).not.toHaveBeenCalled();
    expect(result.current.authGate).toBeNull();
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('cancelAuthGate() drops the replay when the gate is already hidden', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    mockCreateBuyPaymentInfo.mockRejectedValueOnce(new Error('login'));
    mockInterpretDfxAuthError.mockReturnValueOnce(gate);
    const { result } = renderHook(() => useBuyFlow());

    await act(async () => {
      await result.current.createPaymentInfo(QUOTE);
    });
    act(() => {
      result.current.dismissAuthGate(gate);
    });
    expect(result.current.authGate).toBeNull();

    act(() => {
      result.current.cancelAuthGate();
    });
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('keeps an in-flight quote when a cancelled payment fails later', async () => {
    const cases = [{ outcome: 'auth' as const }, { outcome: 'error' as const }];

    for (const { outcome } of cases) {
      mockGetBuyQuote.mockReset();
      mockCreateBuyPaymentInfo.mockReset();
      mockInterpretDfxAuthError.mockReset();
      const gate = { kind: 'login' as const, message: 'sign in' };
      const authErr = new Error('401');
      mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
        err === authErr ? gate : null,
      );
      const payment = deferred<BuyPaymentInfoDto>();
      const quote = deferred<BuyPaymentInfoDto>();
      mockCreateBuyPaymentInfo.mockReturnValueOnce(payment.promise);
      mockGetBuyQuote.mockReturnValueOnce(quote.promise);
      const { result, unmount } = renderHook(() => useBuyFlow());

      let paymentCall: Promise<unknown>;
      act(() => {
        paymentCall = result.current.createPaymentInfo(QUOTE);
      });
      act(() => {
        result.current.cancelAuthGate();
      });
      let quoteCall: Promise<unknown>;
      act(() => {
        quoteCall = result.current.getQuote(QUOTE);
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        if (outcome === 'auth') payment.reject(authErr);
        else payment.reject(new Error('network down'));
        await paymentCall;
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('loading');
      expect(result.current.authGate).toBeNull();
      expect(result.current.error).toBeNull();

      await act(async () => {
        quote.resolve(validInfo({ id: 88, iban: 'CH-QUOTE' }));
        await quoteCall;
      });

      expect(result.current.status).toBe('success');
      expect(result.current.paymentInfo).toMatchObject({ id: 88, iban: 'CH-QUOTE' });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.authGate).toBeNull();
      expect(result.current.error).toBeNull();
      unmount();
    }
  });
});
