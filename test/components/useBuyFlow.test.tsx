import { renderHook, act } from '@testing-library/react-native';
import type { BuyPaymentInfoDto } from '../../src/features/dfx-backend/services/dto';

// Mock the DFX service barrel the hook imports from. We drive every branch
// of the hook's state machine through these two seams and assert on the
// observable state transitions, never on private hook internals.
const mockGetBuyQuote = jest.fn();
const mockCreateBuyPaymentInfo = jest.fn();
const mockConfirmBuy = jest.fn();
const mockInterpretDfxAuthError = jest.fn();

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

  it('re-derives to success and preserves payment info after dismissAuthGate', async () => {
    // First land a valid quote, then open an auth gate on a follow-up
    // payment-info call, then dismiss it.
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

    act(() => {
      result.current.dismissAuthGate();
    });

    expect(result.current.authGate).toBeNull();
    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 7 });
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

    await act(async () => {
      await result.current.retryLast();
    });

    expect(mockGetBuyQuote).toHaveBeenCalledTimes(2);
    expect(mockGetBuyQuote.mock.calls[1]![0]).toEqual(QUOTE);
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
    await act(async () => {
      await result.current.retryLast();
    });

    expect(mockCreateBuyPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockGetBuyQuote).not.toHaveBeenCalled();
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
});
