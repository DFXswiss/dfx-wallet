import { renderHook, act } from '@testing-library/react-native';
import type { SellPaymentInfoDto } from '../../src/features/dfx-backend/services/dto';

const mockGetSellQuote = jest.fn();
const mockCreateSellPaymentInfo = jest.fn();
const mockConfirmSell = jest.fn();
const mockInterpretDfxAuthError = jest.fn();

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

  it('retries sell payment info with the original IBAN-bearing params', async () => {
    mockCreateSellPaymentInfo.mockRejectedValueOnce(new Error('login required'));
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'login', message: 'sign in' });
    mockCreateSellPaymentInfo.mockResolvedValueOnce(validInfo({ id: 12 }));
    const { result } = renderHook(() => useSellFlow());

    await act(async () => {
      await result.current.createPaymentInfo(PAYMENT_PARAMS);
    });
    expect(result.current.status).toBe('authGate');

    await act(async () => {
      await result.current.retryLast();
    });

    expect(mockCreateSellPaymentInfo).toHaveBeenCalledTimes(2);
    expect(mockCreateSellPaymentInfo.mock.calls[1]![0]).toEqual(PAYMENT_PARAMS);
    expect(mockGetSellQuote).not.toHaveBeenCalled();
    expect(result.current.status).toBe('success');
    expect(result.current.paymentInfo).toMatchObject({ id: 12 });
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
});
