import {
  dfxApi,
  DfxApiError,
  DfxApiTimeoutError,
} from '../../src/features/dfx-backend/services/api';

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
    const requests = [dfxApi.get('/v1/user'), dfxApi.get('/v1/user')];
    await Promise.resolve();
    await Promise.resolve();
    resolveRefresh('NEW_TOKEN');
    await expect(Promise.all(requests)).resolves.toEqual([{}, {}]);
    expect(refresh).toHaveBeenCalledTimes(1);
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
