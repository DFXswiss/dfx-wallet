import {
  dfxApi,
  DfxApiError,
  DfxApiTimeoutError,
} from '@/features/dfx-backend/services/api';
import { dfxAuthService } from '@/features/dfx-backend/services/auth-service';

describe('DfxApiError', () => {
  it('should create error with correct properties', () => {
    const error = new DfxApiError(400, 'AMOUNT_TOO_LOW', 'Amount is too low');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('AMOUNT_TOO_LOW');
    expect(error.message).toBe('Amount is too low');
    expect(error.name).toBe('DfxApiError');
  });

  it('should detect KYC required errors', () => {
    const kycError = new DfxApiError(403, 'KYC_LEVEL_REQUIRED', 'KYC required');
    expect(kycError.isKycRequired).toBe(true);

    const kycDataError = new DfxApiError(403, 'KYC_DATA_REQUIRED', 'KYC data required');
    expect(kycDataError.isKycRequired).toBe(true);

    const otherError = new DfxApiError(400, 'AMOUNT_TOO_LOW', 'Amount too low');
    expect(otherError.isKycRequired).toBe(false);
  });

  it('should detect registration required errors', () => {
    const regError = new DfxApiError(403, 'REGISTRATION_REQUIRED', 'Registration required');
    expect(regError.isRegistrationRequired).toBe(true);

    const otherError = new DfxApiError(400, 'AMOUNT_TOO_LOW', 'Amount too low');
    expect(otherError.isRegistrationRequired).toBe(false);
  });

  it('should be an instance of Error', () => {
    const error = new DfxApiError(500, 'SERVER_ERROR', 'Internal server error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DfxApiError);
  });
});

describe('dfxApi request hardening', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => '{}',
    })) as jest.Mock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    dfxApi.clearAuthToken();
    dfxApi.setOnUnauthorized(async () => null);
    dfxAuthService.adoptStoredToken(null);
  });

  it('rejects absolute authenticated URLs to avoid bearer leakage', async () => {
    await expect(dfxApi.get('https://attacker.example/collect')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects protocol-relative URLs', async () => {
    await expect(dfxApi.get('//attacker.example/collect')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('allows normal relative API paths', async () => {
    await dfxApi.get('/v1/asset');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.dfx.swiss/v1/asset',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns raw text when requested', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'csv-file-key',
    });
    await expect(dfxApi.get<string>('/v1/transaction/csv', { responseType: 'text' })).resolves.toBe(
      'csv-file-key',
    );
  });

  it('does not recursively refresh authentication endpoints', async () => {
    const refresh = jest.fn(async () => 'NEW_TOKEN');
    dfxApi.setOnUnauthorized(refresh);
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    });
    await expect(dfxApi.post('/v1/auth', {})).rejects.toBeInstanceOf(DfxApiError);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shares one refresh across concurrent 401 responses', async () => {
    let resolveRefresh!: (token: string) => void;
    const pendingRefresh = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = jest.fn((authGeneration: number) => {
      expect(dfxApi.clearAuthTokenForRefresh(authGeneration)).toBe(true);
      return pendingRefresh.then((token) => {
        expect(dfxApi.setAuthTokenForRefresh(token, authGeneration)).toBe(true);
        return token;
      });
    });
    dfxApi.setOnUnauthorized(refresh);
    const unauthorized = {
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    };
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    const requests = [dfxApi.get('/v1/user'), dfxApi.get('/v1/user')];
    await Promise.resolve();
    await Promise.resolve();
    resolveRefresh('NEW_TOKEN');
    await expect(Promise.all(requests)).resolves.toEqual([{}, {}]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retries when a legacy refresh handler installs its returned token', async () => {
    dfxApi.setAuthToken('OLD_TOKEN');
    dfxApi.setOnUnauthorized(async () => {
      dfxApi.setAuthToken('REFRESHED_TOKEN');
      return 'REFRESHED_TOKEN';
    });
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{}' });

    await expect(dfxApi.get('/v1/user')).resolves.toEqual({});

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect((globalThis.fetch as jest.Mock).mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer REFRESHED_TOKEN' }),
      }),
    );
  });

  it('rejects the original 401 without retrying when auth is cleared during refresh', async () => {
    let resolveRefresh!: (token: string) => void;
    let markRefreshStarted!: () => void;
    let markReplacementRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const replacementRefreshStarted = new Promise<void>((resolve) => {
      markReplacementRefreshStarted = resolve;
    });
    const pendingRefresh = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = jest
      .fn<Promise<string | null>, [number]>()
      .mockImplementationOnce(async (authGeneration) => {
        expect(dfxApi.clearAuthTokenForRefresh(authGeneration)).toBe(true);
        markRefreshStarted();
        const token = await pendingRefresh;
        expect(dfxApi.setAuthTokenForRefresh(token, authGeneration)).toBe(false);
        return token;
      })
      .mockImplementationOnce(async () => {
        markReplacementRefreshStarted();
        return null;
      });
    dfxApi.setAuthToken('OLD_TOKEN');
    dfxApi.setOnUnauthorized(refresh);
    const unauthorized = {
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
    };
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(unauthorized);

    const request = dfxApi.get('/v1/user');
    await refreshStarted;
    dfxApi.clearAuthToken();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const postLogoutRequest = dfxApi.get('/v1/user');
    await replacementRefreshStarted;
    expect(refresh).toHaveBeenCalledTimes(2);
    resolveRefresh('STALE_TOKEN');

    await expect(request).rejects.toMatchObject({
      name: 'DfxApiError',
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Expired',
    });
    await expect(postLogoutRequest).rejects.toBeInstanceOf(DfxApiError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{}',
    });
    await dfxApi.get('/v1/asset');
    expect((globalThis.fetch as jest.Mock).mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
  });

  it('preserves a newly set token when an older refresh resolves', async () => {
    let resolveRefresh!: (token: string) => void;
    let markRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const pendingRefresh = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = jest.fn(() => {
      markRefreshStarted();
      return pendingRefresh;
    });
    dfxApi.setAuthToken('OLD_TOKEN');
    dfxApi.setOnUnauthorized(refresh);
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
    });

    const request = dfxApi.get('/v1/user');
    await refreshStarted;
    dfxApi.setAuthToken('NEW_SESSION_TOKEN');
    resolveRefresh('STALE_TOKEN');

    await expect(request).rejects.toBeInstanceOf(DfxApiError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{}',
    });
    await dfxApi.get('/v1/asset');
    expect((globalThis.fetch as jest.Mock).mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer NEW_SESSION_TOKEN' }),
      }),
    );
  });

  it('preserves a token set after a 401 before refresh login starts', async () => {
    let authGetSpy!: jest.SpyInstance;
    const clearAuthTokenSpy = jest.spyOn(dfxApi, 'clearAuthToken');
    const fetchSpy = globalThis.fetch as jest.Mock;
    dfxApi.setAuthToken('OLD_TOKEN');
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setOnUnauthorized(async (authGeneration) => {
      dfxApi.setAuthToken('NEWER_TOKEN');
      authGetSpy = jest
        .spyOn(dfxApi, 'get')
        .mockRejectedValue(new Error('Unexpected authentication request'));
      try {
        return await dfxAuthService.refresh(
          '0xaddress',
          jest.fn().mockResolvedValue('SIGNATURE'),
          authGeneration,
        );
      } catch {
        return null;
      }
    });
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{}' });

    await expect(dfxApi.get('/v1/test')).rejects.toMatchObject({
      name: 'DfxApiError',
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Expired',
    });
    expect(authGetSpy).not.toHaveBeenCalled();
    expect(clearAuthTokenSpy).not.toHaveBeenCalled();

    authGetSpy.mockRestore();
    await dfxApi.get('/v1/test');
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer NEWER_TOKEN' }),
      }),
    );
  });

  it('cleans up the pending response when token refresh rejects', async () => {
    const controller = new AbortController();
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    const removeAbortListenerSpy = jest.spyOn(controller.signal, 'removeEventListener');
    dfxApi.setOnUnauthorized(async () => {
      throw new Error('refresh failed');
    });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    });

    await expect(dfxApi.get('/v1/user', { signal: controller.signal })).rejects.toThrow(
      'refresh failed',
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(removeAbortListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('aborts one caller while a shared token refresh remains pending', async () => {
    let resolveRefresh!: (token: string | null) => void;
    const pendingRefresh = new Promise<string | null>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = jest.fn(() => pendingRefresh);
    dfxApi.setOnUnauthorized(refresh);
    const unauthorized = {
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    };
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    const controller = new AbortController();

    const abortedRequest = dfxApi.get('/v1/user', { signal: controller.signal });
    const completedRequest = dfxApi.get('/v1/user');
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    await expect(abortedRequest).rejects.toMatchObject({ name: 'AbortError' });
    resolveRefresh('NEW_TOKEN');
    await expect(completedRequest).resolves.toEqual({});
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('times out while a shared token refresh remains pending', async () => {
    jest.useFakeTimers();
    let resolveRefresh!: (token: string | null) => void;
    const pendingRefresh = new Promise<string | null>((resolve) => {
      resolveRefresh = resolve;
    });
    dfxApi.setOnUnauthorized(() => pendingRefresh);
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    });

    const request = dfxApi.get('/v1/user', { timeoutMs: 25 });
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(25);

    await expect(request).rejects.toBeInstanceOf(DfxApiTimeoutError);
    resolveRefresh(null);
    await pendingRefresh;
  });

  it('keeps an authenticated retry within the original request deadline', async () => {
    jest.useFakeTimers();
    dfxApi.setOnUnauthorized(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('NEW_TOKEN'), 24);
        }),
    );
    const unauthorized = {
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    };
    let retrySignal: AbortSignal | undefined;
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(unauthorized)
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            retrySignal = init.signal ?? undefined;
            retrySignal?.addEventListener('abort', () => reject(new Error('retry aborted')), {
              once: true,
            });
          }),
      );

    const request = dfxApi.get('/v1/user', { timeoutMs: 25 });
    const assertion = expect(request).rejects.toMatchObject({
      name: 'DfxApiTimeoutError',
      timeoutMs: 25,
    });
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(24);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(1);

    expect(retrySignal?.aborted).toBe(true);
    await assertion;
  });

  it('does not retry when token refresh exhausts the original request deadline', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    dfxApi.setOnUnauthorized(async () => {
      jest.setSystemTime(25);
      return 'NEW_TOKEN';
    });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    });

    await expect(dfxApi.get('/v1/user', { timeoutMs: 25 })).rejects.toMatchObject({
      name: 'DfxApiTimeoutError',
      timeoutMs: 25,
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts a request after the configured timeout', async () => {
    (globalThis.fetch as jest.Mock).mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await expect(dfxApi.get('/v1/user', { timeoutMs: 1 })).rejects.toBeInstanceOf(
      DfxApiTimeoutError,
    );
  });

  it('keeps the timeout active while a successful response body is still hanging', async () => {
    jest.useFakeTimers();
    let bodyStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      bodyStarted = resolve;
    });
    (globalThis.fetch as jest.Mock).mockImplementationOnce(
      async (_url: string, init: RequestInit) =>
        ({
          ok: true,
          status: 200,
          text: () => {
            bodyStarted();
            return new Promise<string>((_resolve, reject) => {
              init.signal?.addEventListener('abort', () => reject(new Error('body aborted')), {
                once: true,
              });
            });
          },
        }) as unknown as Response,
    );

    const request = dfxApi.get('/v1/user', { timeoutMs: 25 });
    await started;
    jest.advanceTimersByTime(25);

    await expect(request).rejects.toBeInstanceOf(DfxApiTimeoutError);
  });

  it('aborts a request when the caller signal aborts', async () => {
    let revealSignal!: (signal: AbortSignal) => void;
    const signalCaptured = new Promise<AbortSignal>((resolve) => {
      revealSignal = resolve;
    });
    (globalThis.fetch as jest.Mock).mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal;
          if (!signal) {
            reject(new Error('missing signal'));
            return;
          }
          revealSignal(signal);
          signal.addEventListener('abort', () => reject(new Error('caller-aborted')), {
            once: true,
          });
        }),
    );
    const controller = new AbortController();

    const request = dfxApi.get('/v1/user', { signal: controller.signal });
    const fetchSignal = await signalCaptured;
    controller.abort();

    expect(fetchSignal.aborted).toBe(true);
    await expect(request).rejects.toThrow('caller-aborted');
  });
});
