import { renderHook, act } from '@testing-library/react-native';
import { DfxApiTimeoutError } from '@/features/dfx-backend/services/api';
import type { SellPaymentInfoDto } from '../../src/features/dfx-backend/services/dto';

const mockGetSellQuote = jest.fn();
const mockCreateSellPaymentInfo = jest.fn();
const mockConfirmSell = jest.fn();
const mockInterpretDfxAuthError = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxPaymentService: {
    getSellQuote: (...args: unknown[]) => mockGetSellQuote(...args),
    createSellPaymentInfo: (...args: unknown[]) => mockCreateSellPaymentInfo(...args),
    confirmSell: (...args: unknown[]) => mockConfirmSell(...args),
  },
  interpretDfxAuthError: (...args: unknown[]) => mockInterpretDfxAuthError(...args),
}));

// eslint-disable-next-line import/first
import { useSellFlow } from '../../src/features/buy-sell/useSellFlow';

const QUOTE = {
  amount: 100,
  asset: 'BTC',
  blockchain: 'Bitcoin',
  currency: 'CHF',
  chain: 'bitcoin' as const,
};

const PAYMENT_PARAMS = {
  ...QUOTE,
  iban: 'CH9300762011623852957',
};

function validInfo(overrides: Partial<SellPaymentInfoDto> = {}): SellPaymentInfoDto {
  return { id: 10, isValid: true, ...overrides } as unknown as SellPaymentInfoDto;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockGetSellQuote.mockReset();
  mockCreateSellPaymentInfo.mockReset();
  mockConfirmSell.mockReset();
  mockInterpretDfxAuthError.mockReset();
  mockInterpretDfxAuthError.mockReturnValue(null);
});

describe('useSellFlow', () => {
  it('stores a valid sell quote and exposes a successful state', async () => {
    mockGetSellQuote.mockResolvedValueOnce(validInfo({ id: 11 }));
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    const quoteSignal = mockGetSellQuote.mock.calls[0]![1].signal as AbortSignal;
    expect(mockGetSellQuote.mock.calls[0]![0]).toEqual(QUOTE);
    expect(quoteSignal.aborted).toBe(false);
    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 11, isValid: true });
    expect(result.current.error).toBeNull();
    expect(result.current.authGate).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('aborts a stale quote and keeps the newer quote result', async () => {
    const first = deferred<SellPaymentInfoDto>();
    const second = deferred<SellPaymentInfoDto>();
    mockGetSellQuote.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useSellFlow());

    let firstCall: Promise<unknown>;
    act(() => {
      firstCall = result.current.getQuote(QUOTE);
    });
    let secondCall: Promise<unknown>;
    act(() => {
      secondCall = result.current.getQuote({ ...QUOTE, amount: 200 });
    });

    const firstSignal = mockGetSellQuote.mock.calls[0]![1].signal as AbortSignal;
    const secondSignal = mockGetSellQuote.mock.calls[1]![1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    await act(async () => {
      second.resolve(validInfo({ id: 2 }));
      await secondCall;
    });
    await act(async () => {
      first.resolve(validInfo({ id: 1 }));
      await firstCall;
    });

    expect(result.current.paymentInfo).toMatchObject({ id: 2 });
    expect(result.current.status).toBe('success');
  });

  it('enriches a link-chain auth gate with the attempted sell chain', async () => {
    mockGetSellQuote.mockRejectedValueOnce(new Error('asset blockchain mismatch'));
    mockInterpretDfxAuthError.mockReturnValueOnce({
      kind: 'linkChain',
      message: 'link Bitcoin',
    });
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    expect(result.current.status).toBe('authGate');
    expect(result.current.authGate).toMatchObject({ kind: 'linkChain', chain: 'bitcoin' });
    expect(result.current.error).toBeNull();
  });

  it('translates a DFX API timeout instead of exposing its raw message', async () => {
    const timeout = new DfxApiTimeoutError(15_000);
    mockCreateSellPaymentInfo.mockRejectedValueOnce(timeout);
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('common.requestTimeout');
    expect(result.current.error).not.toBe(timeout.message);
  });

  it('dismisses only the identified auth gate while preserving no-argument behavior', async () => {
    const staleGate = { kind: 'kyc' as const, message: 'finish KYC' };
    const currentGate = { kind: 'login' as const, message: 'sign in' };
    const noArgumentGate = { kind: 'registration' as const, message: 'register' };
    mockGetSellQuote
      .mockRejectedValueOnce(new Error('kyc'))
      .mockRejectedValueOnce(new Error('login'))
      .mockRejectedValueOnce(new Error('registration'));
    mockInterpretDfxAuthError
      .mockReturnValueOnce(staleGate)
      .mockReturnValueOnce(currentGate)
      .mockReturnValueOnce(noArgumentGate);
    const { result } = renderHook(() => useSellFlow());

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

  it('retries the last sell quote and identifies the result as a quote', async () => {
    mockGetSellQuote.mockRejectedValueOnce(new Error('login required'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'login', message: 'sign in' });
    mockGetSellQuote.mockResolvedValueOnce(validInfo({ id: 12 }));
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });

    let retryResult: {
      kind: 'quote' | 'paymentInfo';
      info: SellPaymentInfoDto | null;
    } | null = null;
    await act(async () => {
      retryResult = await result.current.retryLast();
    });

    expect(mockGetSellQuote).toHaveBeenCalledTimes(2);
    expect(mockGetSellQuote.mock.calls[1]![0]).toEqual(QUOTE);
    expect(mockCreateSellPaymentInfo).not.toHaveBeenCalled();
    expect(retryResult).toMatchObject({
      kind: 'quote',
      info: { id: 12, isValid: true },
    });
  });

  it('retries sell payment info with the original IBAN-bearing params', async () => {
    mockCreateSellPaymentInfo.mockRejectedValueOnce(new Error('login required'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'login', message: 'sign in' });
    mockCreateSellPaymentInfo.mockResolvedValueOnce(validInfo({ id: 12 }));
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    expect(result.current.status).toBe('authGate');

    let retryResult: {
      kind: 'quote' | 'paymentInfo';
      info: SellPaymentInfoDto | null;
    } | null = null;
    await act(async () => {
      retryResult = await result.current.retryLast();
    });

    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockCreateSellPaymentInfo.mock.calls[1]![0]).toEqual(PAYMENT_PARAMS);
    expect(mockGetSellQuote).not.toHaveBeenCalled();
    expect(retryResult).toMatchObject({
      kind: 'paymentInfo',
      info: { id: 12, isValid: true },
    });
    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 12 });
  });

  it('retryLast returns null after a successful createPaymentInfo', async () => {
    mockCreateSellPaymentInfo.mockResolvedValueOnce(validInfo({ id: 12 }));
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });

    let retryResult: Awaited<ReturnType<typeof result.current.retryLast>> = null;
    await act(async () => {
      retryResult = await result.current.retryLast();
    });

    expect(retryResult).toBeNull();
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('does not expose a payment-info retry before an auth failure occurs', async () => {
    const pending = deferred<SellPaymentInfoDto>();
    mockCreateSellPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useSellFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(validInfo());
      await paymentCall;
    });
  });

  it('does not replay payment info after a non-authentication failure', async () => {
    mockCreateSellPaymentInfo.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });

    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('confirms a sell payment and preserves the successful payment state', async () => {
    mockCreateSellPaymentInfo.mockResolvedValueOnce(validInfo({ id: 13 }));
    mockConfirmSell.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirmSell(13);
    });

    expect(ok).toBe(true);
    expect(mockConfirmSell).toHaveBeenCalledWith(13);
    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 13 });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns false and keeps payment info visible when sell confirmation fails', async () => {
    mockCreateSellPaymentInfo.mockResolvedValueOnce(validInfo({ id: 14 }));
    mockConfirmSell.mockRejectedValueOnce(new Error('confirm boom'));
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirmSell(14);
    });

    expect(ok).toBe(false);
    expect(mockConfirmSell).toHaveBeenCalledWith(14);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('confirm boom');
    expect(result.current.paymentInfo).toMatchObject({ id: 14 });
    expect(result.current.isLoading).toBe(false);
  });

  it('reset aborts an in-flight quote and prevents stale quote state', async () => {
    const pending = deferred<SellPaymentInfoDto>();
    mockGetSellQuote.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useSellFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.getQuote(QUOTE);
    });
    const signal = mockGetSellQuote.mock.calls[0]![1].signal as AbortSignal;

    act(() => {
      result.current.reset();
    });

    expect(signal.aborted).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.authGate).toBeNull();

    await act(async () => {
      pending.resolve(validInfo({ id: 99 }));
      await call;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.paymentInfo).toBeNull();
  });

  it('applies a payment-info auth error after a newer quote succeeds', async () => {
    const stale = { ...PAYMENT_PARAMS, amount: 50 };
    const fresh = { ...QUOTE, amount: 500 };
    const authErr = new Error('401');
    const pending = deferred<SellPaymentInfoDto>();
    mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
      err === authErr ? { kind: 'linkChain', message: 'link' } : null,
    );
    mockCreateSellPaymentInfo.mockReturnValueOnce(pending.promise);
    mockGetSellQuote.mockResolvedValueOnce(validInfo({ id: 500, depositAddress: 'bc1q-quote' }));
    const { result } = renderHook(() => useSellFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo(stale);
    });
    const paymentSignal = mockCreateSellPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    await act(async () => {
      await result.current.getQuote(fresh);
    });

    expect(paymentSignal.aborted).toBe(false);
    expect(result.current.paymentInfo).toMatchObject({ id: 500, depositAddress: 'bc1q-quote' });
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
    mockCreateSellPaymentInfo.mockResolvedValueOnce(
      validInfo({ id: 51, depositAddress: 'bc1q-replay' }),
    );
    await act(async () => {
      await expect(result.current.retryLast()).resolves.toMatchObject({
        kind: 'paymentInfo',
        info: { id: 51, depositAddress: 'bc1q-replay' },
      });
    });
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockCreateSellPaymentInfo.mock.calls[0]![0]).toMatchObject({ amount: 50 });
    expect(mockGetSellQuote).toHaveBeenCalledTimes(1);
  });

  it('applies a late non-auth payment error while a newer quote gate is open', async () => {
    const pending = deferred<SellPaymentInfoDto>();
    const quoteAuth = new Error('login');
    mockCreateSellPaymentInfo.mockReturnValueOnce(pending.promise);
    mockGetSellQuote.mockRejectedValueOnce(quoteAuth);
    mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
      err === quoteAuth ? { kind: 'login', message: 'sign in' } : null,
    );
    const { result } = renderHook(() => useSellFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo({ ...PAYMENT_PARAMS, amount: 50 });
    });

    await act(async () => {
      await result.current.getQuote({ ...QUOTE, amount: 500 });
    });
    expect(result.current.status).toBe('authGate');

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
    expect(mockGetSellQuote).toHaveBeenCalledTimes(1);
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('ignores a late quote after sell payment info was created', async () => {
    const quotePending = deferred<SellPaymentInfoDto>();
    mockGetSellQuote.mockReturnValueOnce(quotePending.promise);
    mockCreateSellPaymentInfo.mockResolvedValueOnce(
      validInfo({ id: 9, depositAddress: 'bc1q-committed' }),
    );
    const { result } = renderHook(() => useSellFlow());

    let quoteCall: Promise<unknown>;
    act(() => {
      quoteCall = result.current.getQuote(QUOTE);
    });
    const quoteSignal = mockGetSellQuote.mock.calls[0]![1].signal as AbortSignal;

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });

    expect(quoteSignal.aborted).toBe(false);
    expect(result.current.paymentInfo).toMatchObject({
      id: 9,
      depositAddress: 'bc1q-committed',
    });

    await act(async () => {
      quotePending.resolve(validInfo({ id: 1, depositAddress: 'bc1q-stale-quote' }));
      await quoteCall;
    });

    expect(result.current.paymentInfo).toMatchObject({
      id: 9,
      depositAddress: 'bc1q-committed',
    });
    expect(result.current.status).toBe('success');
  });

  it('applies payment info started before a quote and ignores that late quote', async () => {
    const paymentPending = deferred<SellPaymentInfoDto>();
    const quotePending = deferred<SellPaymentInfoDto>();
    mockCreateSellPaymentInfo.mockReturnValueOnce(paymentPending.promise);
    mockGetSellQuote.mockReturnValueOnce(quotePending.promise);
    const { result } = renderHook(() => useSellFlow());

    let paymentCall: Promise<unknown>;
    act(() => {
      paymentCall = result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    const paymentSignal = mockCreateSellPaymentInfo.mock.calls[0]![1].signal as AbortSignal;
    let quoteCall: Promise<unknown>;
    act(() => {
      quoteCall = result.current.getQuote({ ...QUOTE, amount: 500 });
    });

    expect(paymentSignal.aborted).toBe(false);

    await act(async () => {
      paymentPending.resolve(validInfo({ id: 9, depositAddress: 'bc1q-committed' }));
      await paymentCall;
    });
    expect(result.current.paymentInfo).toMatchObject({
      id: 9,
      depositAddress: 'bc1q-committed',
    });
    expect(result.current.status).toBe('success');

    await act(async () => {
      quotePending.resolve(validInfo({ id: 1, depositAddress: 'bc1q-quote' }));
      await quoteCall;
    });
    expect(result.current.paymentInfo).toMatchObject({
      id: 9,
      depositAddress: 'bc1q-committed',
    });
    expect(result.current.status).toBe('success');
  });

  it('drops payment info when an auth error is dismissed', async () => {
    mockGetSellQuote.mockResolvedValueOnce(validInfo({ id: 7, depositAddress: 'bc1q-quote' }));
    mockCreateSellPaymentInfo.mockRejectedValueOnce(new Error('kyc'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'kyc', message: 'finish kyc' });
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.getQuote(QUOTE);
    });
    expect(result.current.status).toBe('success');

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
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

  it('keeps the newer deposit address when an older payment call resolves last', async () => {
    const first = deferred<SellPaymentInfoDto>();
    const second = deferred<SellPaymentInfoDto>();
    mockCreateSellPaymentInfo
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useSellFlow());

    let firstCall: Promise<unknown>;
    act(() => {
      firstCall = result.current.createPaymentInfo({ ...PAYMENT_PARAMS, amount: 50 });
    });
    let secondCall: Promise<unknown>;
    act(() => {
      secondCall = result.current.createPaymentInfo({ ...PAYMENT_PARAMS, amount: 500 });
    });

    const firstSignal = mockCreateSellPaymentInfo.mock.calls[0]![1].signal as AbortSignal;
    const secondSignal = mockCreateSellPaymentInfo.mock.calls[1]![1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    await act(async () => {
      second.resolve(validInfo({ id: 2, depositAddress: 'bc1q-newer' }));
      await secondCall;
    });
    expect(result.current.paymentInfo).toMatchObject({
      id: 2,
      depositAddress: 'bc1q-newer',
    });

    await act(async () => {
      first.resolve(validInfo({ id: 1, depositAddress: 'bc1q-older' }));
      await firstCall;
    });
    expect(result.current.paymentInfo).toMatchObject({
      id: 2,
      depositAddress: 'bc1q-newer',
    });
    expect(result.current.status).toBe('success');
  });

  it('ignores a payment-info response after reset and aborts its signal', async () => {
    const pending = deferred<SellPaymentInfoDto>();
    mockCreateSellPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useSellFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    const signal = mockCreateSellPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    act(() => {
      result.current.reset();
    });

    expect(signal.aborted).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.paymentInfo).toBeNull();

    await act(async () => {
      pending.resolve(validInfo({ id: 9, depositAddress: 'bc1q-late' }));
      await call;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.paymentInfo).toBeNull();
    expect(result.current.authGate).toBeNull();
  });

  it('aborts an in-flight payment info when the hook unmounts', async () => {
    const pending = deferred<SellPaymentInfoDto>();
    mockCreateSellPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useSellFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    const signal = mockCreateSellPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    unmount();
    expect(signal.aborted).toBe(true);

    await act(async () => {
      pending.resolve(validInfo({ id: 9, depositAddress: 'bc1q-unmounted' }));
      await call;
    });
  });

  it('replays after dismissAuthGate and replays nothing after cancelAuthGate', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    const other = { kind: 'kyc' as const, message: 'finish KYC' };
    mockCreateSellPaymentInfo
      .mockRejectedValueOnce(new Error('login'))
      .mockResolvedValueOnce(validInfo({ id: 4 }))
      .mockRejectedValueOnce(new Error('login'));
    mockInterpretDfxAuthError.mockReturnValueOnce(gate).mockReturnValueOnce(gate);
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo({ ...PAYMENT_PARAMS, amount: 50 });
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
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockCreateSellPaymentInfo.mock.calls[1]![0]).toMatchObject({ amount: 50 });
    expect(result.current.status).toBe('success');

    await act(async () => {
      await result.current.createPaymentInfo({ ...PAYMENT_PARAMS, amount: 75 });
    });
    expect(result.current.authGate).toEqual(gate);

    act(() => {
      result.current.cancelAuthGate(gate);
    });
    expect(result.current.authGate).toBeNull();

    await act(async () => {
      await expect(result.current.retryLast()).resolves.toBeNull();
    });
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(3);
  });

  it('keeps payment info when confirm fails with an auth error', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    mockCreateSellPaymentInfo.mockResolvedValueOnce(
      validInfo({ id: 8, depositAddress: 'bc1q-keep' }),
    );
    mockConfirmSell.mockRejectedValueOnce(new Error('401'));
    mockInterpretDfxAuthError.mockReturnValueOnce(gate);
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirmSell(8);
    });

    expect(ok).toBe(false);
    expect(result.current.paymentInfo).toMatchObject({ id: 8, depositAddress: 'bc1q-keep' });
    expect(result.current.authGate).toEqual(gate);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores a confirm that settles after reset', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    const rejected = deferred<void>();
    const resolved = deferred<void>();
    mockConfirmSell.mockReturnValueOnce(rejected.promise).mockReturnValueOnce(resolved.promise);
    mockInterpretDfxAuthError.mockReturnValue(gate);

    const rejectedHook = renderHook(() => useSellFlow());
    let rejectedCall: Promise<boolean>;
    act(() => {
      rejectedCall = rejectedHook.result.current.confirmSell(1);
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

    const resolvedHook = renderHook(() => useSellFlow());
    let resolvedCall: Promise<boolean>;
    act(() => {
      resolvedCall = resolvedHook.result.current.confirmSell(2);
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

  it('drops a late quote after cancelAuthGate', async () => {
    const cases = [{ outcome: 'auth' as const }, { outcome: 'ok' as const }];

    for (const { outcome } of cases) {
      mockGetSellQuote.mockReset();
      mockInterpretDfxAuthError.mockReset();
      const gate = { kind: 'login' as const, message: 'sign in' };
      const authErr = new Error('401');
      mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
        err === authErr ? gate : null,
      );
      const pending = deferred<SellPaymentInfoDto>();
      mockGetSellQuote.mockReturnValueOnce(pending.promise);
      const { result, unmount } = renderHook(() => useSellFlow());

      let call: Promise<unknown>;
      act(() => {
        call = result.current.getQuote(QUOTE);
      });
      const signal = mockGetSellQuote.mock.calls[0]![1].signal as AbortSignal;

      act(() => {
        result.current.cancelAuthGate();
      });
      expect(signal.aborted).toBe(true);

      await act(async () => {
        if (outcome === 'auth') pending.reject(authErr);
        else pending.resolve(validInfo({ id: 77, depositAddress: 'bc1q-late' }));
        await call;
      });

      expect(result.current.authGate).toBeNull();
      expect(result.current.paymentInfo).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      const callsBeforeRetry = mockGetSellQuote.mock.calls.length;
      await act(async () => {
        await expect(result.current.retryLast()).resolves.toBeNull();
      });
      expect(mockGetSellQuote.mock.calls.length).toBe(callsBeforeRetry);
      unmount();
    }
  });

  it('applies payment info that resolves after cancelAuthGate', async () => {
    const pending = deferred<SellPaymentInfoDto>();
    mockCreateSellPaymentInfo.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useSellFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    const signal = mockCreateSellPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

    act(() => {
      result.current.cancelAuthGate();
    });
    expect(signal.aborted).toBe(false);

    await act(async () => {
      pending.resolve(validInfo({ id: 77, depositAddress: 'bc1q-late' }));
      await call;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 77, depositAddress: 'bc1q-late' });
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
    const pending = deferred<SellPaymentInfoDto>();
    mockCreateSellPaymentInfo.mockReturnValueOnce(pending.promise);
    mockInterpretDfxAuthError.mockImplementation((err: unknown) => (err === authErr ? gate : null));
    const { result } = renderHook(() => useSellFlow());

    let call: Promise<unknown>;
    act(() => {
      call = result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    const signal = mockCreateSellPaymentInfo.mock.calls[0]![1].signal as AbortSignal;

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
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('cancelAuthGate() drops the replay when the gate is already hidden', async () => {
    const gate = { kind: 'login' as const, message: 'sign in' };
    mockCreateSellPaymentInfo.mockRejectedValueOnce(new Error('login'));
    mockInterpretDfxAuthError.mockReturnValueOnce(gate);
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
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
    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(1);
  });

  it('keeps an in-flight quote when a cancelled payment fails later', async () => {
    const cases = [{ outcome: 'auth' as const }, { outcome: 'error' as const }];

    for (const { outcome } of cases) {
      mockGetSellQuote.mockReset();
      mockCreateSellPaymentInfo.mockReset();
      mockInterpretDfxAuthError.mockReset();
      const gate = { kind: 'login' as const, message: 'sign in' };
      const authErr = new Error('401');
      mockInterpretDfxAuthError.mockImplementation((err: unknown) =>
        err === authErr ? gate : null,
      );
      const payment = deferred<SellPaymentInfoDto>();
      const quote = deferred<SellPaymentInfoDto>();
      mockCreateSellPaymentInfo.mockReturnValueOnce(payment.promise);
      mockGetSellQuote.mockReturnValueOnce(quote.promise);
      const { result, unmount } = renderHook(() => useSellFlow());

      let paymentCall: Promise<unknown>;
      act(() => {
        paymentCall = result.current.createPaymentInfo(PAYMENT_PARAMS);
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
        quote.resolve(validInfo({ id: 88, depositAddress: 'bc1q-quote' }));
        await quoteCall;
      });

      expect(result.current.status).toBe('success');
      expect(result.current.paymentInfo).toMatchObject({ id: 88, depositAddress: 'bc1q-quote' });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.authGate).toBeNull();
      expect(result.current.error).toBeNull();
      unmount();
    }
  });
});
