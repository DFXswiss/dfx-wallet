import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import { dfxAuthService } from '../../src/features/dfx-backend/services/auth-service';

/**
 * Leave `dfxAuthService` holding `sessionToken` while `dfxApi` has no Bearer,
 * which is the state a generation-bound refresh creates. `generation` is the
 * one `clearAuthTokenForRefresh` accepted. The fetch spy's next call would
 * succeed as an unauthenticated login.
 */
async function clearApiTokenForInFlightRefresh(sessionToken: string): Promise<{
  fetchSpy: jest.SpyInstance;
  generation: number;
}> {
  dfxAuthService.adoptStoredToken(sessionToken);
  dfxApi.setAuthToken(sessionToken);
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
  } as unknown as Response);
  let generation: number | undefined;
  dfxApi.setOnUnauthorized(async (authGeneration) => {
    generation = authGeneration;
    return null;
  });
  try {
    await expect(dfxApi.get('/v1/user')).rejects.toBeInstanceOf(DfxApiError);
    if (generation === undefined) {
      throw new Error('Expected the 401 handler to observe an auth generation');
    }
    expect(dfxApi.clearAuthTokenForRefresh(generation)).toBe(true);
  } finally {
    dfxApi.setOnUnauthorized(async () => null);
  }
  fetchSpy.mockClear();
  fetchSpy.mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ accessToken: 'FOREIGN_ACCOUNT' }),
  } as unknown as Response);
  if (generation === undefined) {
    throw new Error('Expected the 401 handler to observe an auth generation');
  }
  return { fetchSpy, generation };
}

/**
 * Read the current auth generation. The probe returns no token, so neither
 * the api token nor the generation changes.
 */
async function captureAuthGeneration(): Promise<number> {
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
  } as unknown as Response);
  let generation: number | undefined;
  dfxApi.setOnUnauthorized(async (authGeneration) => {
    generation = authGeneration;
    return null;
  });
  try {
    await expect(dfxApi.get('/v1/user')).rejects.toBeInstanceOf(DfxApiError);
  } finally {
    dfxApi.setOnUnauthorized(async () => null);
    fetchSpy.mockRestore();
  }
  if (generation === undefined) {
    throw new Error('Expected the 401 handler to observe an auth generation');
  }
  return generation;
}

describe('dfxAuthService.login', () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;
  let clearAuthTokenSpy: jest.SpyInstance;
  let setAuthTokenSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(dfxApi, 'get');
    postSpy = jest.spyOn(dfxApi, 'post');
    clearAuthTokenSpy = jest.spyOn(dfxApi, 'clearAuthToken');
    setAuthTokenSpy = jest.spyOn(dfxApi, 'setAuthToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxAuthService.adoptStoredToken(null);
  });

  it('drops any existing Bearer before doing a fresh signature login', async () => {
    dfxAuthService.adoptStoredToken('STALE_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'OWNER_TOKEN' });

    const token = await dfxAuthService.login('0xabc', async () => 'SIG', {
      wallet: 'DFX Wallet',
    });

    expect(clearAuthTokenSpy).toHaveBeenCalled();
    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: '0xabc',
        signature: 'SIG',
        wallet: 'DFX Wallet',
      },
      { anonymous: true },
    );
    expect(token).toBe('OWNER_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OWNER_TOKEN');
  });

  it('restores the previous token if a fresh signature login fails', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockRejectedValueOnce(new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature'));

    await expect(dfxAuthService.login('0xabc', async () => 'BAD')).rejects.toThrow(
      /Invalid signature/,
    );

    expect(clearAuthTokenSpy).toHaveBeenCalled();
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OLD_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
  });

  it('does not restore the previous token when a session was adopted during login', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockImplementationOnce(async () => {
      dfxAuthService.adoptStoredToken('NEWER_TOKEN');
      dfxApi.setAuthToken('NEWER_TOKEN');
      throw new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature');
    });

    await expect(dfxAuthService.login('0xabc', async () => 'BAD')).rejects.toThrow(
      /Invalid signature/,
    );

    expect(dfxAuthService.getAccessToken()).toBe('NEWER_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('NEWER_TOKEN');
  });
});

describe('dfxAuthService login posts carry no bearer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    dfxApi.setOnUnauthorized(async () => null);
    dfxAuthService.logout();
  });

  function mockAuthFetch(): jest.SpyInstance {
    return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/v1/auth/signMessage')
        ? JSON.stringify({ message: 'sign me' })
        : JSON.stringify({ accessToken: 'OWNER_TOKEN' });
      return {
        ok: true,
        status: 200,
        text: async () => body,
      } as unknown as Response;
    });
  }

  function expectLoginPostWithoutAuthorization(fetchSpy: jest.SpyInstance): void {
    const postCall = fetchSpy.mock.calls.find(
      (call) =>
        call[0] === 'https://api.dfx.swiss/v1/auth' &&
        (call[1] as { method?: string } | undefined)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const headers = (postCall?.[1] as { headers?: Record<string, string> } | undefined)?.headers;
    expect(headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(headers).not.toHaveProperty('Authorization');
  }

  it('sends POST /v1/auth with no Authorization when a foreign token appears during login', async () => {
    dfxAuthService.logout();
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setAuthToken('OLD_TOKEN');
    const fetchSpy = mockAuthFetch();

    await dfxAuthService.login('0xabc', async () => {
      dfxApi.setAuthToken('FOREIGN');
      return 'SIG';
    });

    expectLoginPostWithoutAuthorization(fetchSpy);
  });

  it('sends a refresh POST /v1/auth with no Authorization when a foreign token appears', async () => {
    dfxAuthService.logout();
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setAuthToken('OLD_TOKEN');
    const generation = await captureAuthGeneration();
    const fetchSpy = mockAuthFetch();

    await expect(
      dfxAuthService.login(
        '0xabc',
        async () => {
          dfxApi.setAuthToken('FOREIGN');
          return 'SIG';
        },
        undefined,
        generation,
      ),
    ).rejects.toThrow('Authentication changed while token refresh was pending.');

    expectLoginPostWithoutAuthorization(fetchSpy);
  });
});

describe('dfxAuthService.linkAddress', () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;
  let setAuthTokenSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(dfxApi, 'get');
    postSpy = jest.spyOn(dfxApi, 'post');
    setAuthTokenSpy = jest.spyOn(dfxApi, 'setAuthToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxAuthService.adoptStoredToken(null);
  });

  it('throws when no session is active', async () => {
    dfxAuthService.adoptStoredToken(null);
    await expect(
      dfxAuthService.linkAddress('0xabc', async () => 'sig', { blockchain: 'Bitcoin' }),
    ).rejects.toThrow(/Not authenticated/);
    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('rotates the JWT to the freshly-issued token on success', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'NEW_TOKEN' });

    const signFn = jest.fn().mockResolvedValue('SIGNATURE');
    const newToken = await dfxAuthService.linkAddress('bc1qabc', signFn, {
      wallet: 'DFX Wallet',
      blockchain: 'Bitcoin',
    });

    expect(signFn).toHaveBeenCalledWith('sign me');
    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: 'bc1qabc',
        signature: 'SIGNATURE',
        wallet: 'DFX Wallet',
        blockchain: 'Bitcoin',
      },
      { requireAuth: true },
    );
    expect(newToken).toBe('NEW_TOKEN');
    // The fresh JWT must replace the old one so /buy/quote stops returning
    // "Asset blockchain mismatch" — this was the regression we fixed.
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('NEW_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('NEW_TOKEN');
  });

  it('leaves the access token and api token unchanged when /v1/auth fails', async () => {
    // setAuthToken bumps the generation unless the api token is already equal.
    // Start with no api token so a guarded restore would show up here.
    getSpy.mockRestore();
    dfxApi.clearAuthToken();
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    const generation = await captureAuthGeneration();
    jest.spyOn(dfxApi, 'get').mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockRejectedValueOnce(
      new DfxApiError(409, 'CONFLICT', 'Address belongs to another user'),
    );

    await expect(
      dfxAuthService.linkAddress('bc1qabc', async () => 'SIG', { blockchain: 'Bitcoin' }),
    ).rejects.toThrow(/Address belongs to another user/);

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    postSpy.mockRestore();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    } as unknown as Response);
    await expect(
      dfxApi.post('/v1/auth', { address: 'bc1qabc' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
    expect(dfxApi.setAuthTokenForRefresh('NEW', generation)).toBe(true);
  });

  it('omits the blockchain hint when none is provided', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'NEW' });

    await dfxAuthService.linkAddress('addr', async () => 'SIG');

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: 'addr',
        signature: 'SIG',
        wallet: 'DFX Wallet',
      },
      { requireAuth: true },
    );
  });

  it('rejects a link while a refresh has cleared the api token and does not log in', async () => {
    getSpy.mockRestore();
    postSpy.mockRestore();
    const { fetchSpy } = await clearApiTokenForInFlightRefresh('OLD_TOKEN');
    jest.spyOn(dfxApi, 'get').mockResolvedValue({ message: 'sign me' });

    await expect(dfxAuthService.linkAddress('bc1qabc', async () => 'SIG')).rejects.toThrow(
      'Authentication required',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
  });

  it('does not sabotage a refresh that cleared the api token', async () => {
    getSpy.mockRestore();
    postSpy.mockRestore();
    const { generation } = await clearApiTokenForInFlightRefresh('OLD_TOKEN');
    jest.spyOn(dfxApi, 'get').mockResolvedValue({ message: 'sign me' });

    await expect(dfxAuthService.linkAddress('bc1qabc', async () => 'SIG')).rejects.toThrow(
      'Authentication required',
    );

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    await expect(
      dfxApi.post('/v1/auth', { address: 'bc1qabc' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
    expect(dfxApi.setAuthTokenForRefresh('REFRESHED', generation)).toBe(true);
  });

  it('does not restore the previous token when the session was replaced while linking', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockImplementationOnce(async () => {
      dfxAuthService.adoptStoredToken('NEWER_TOKEN');
      dfxApi.setAuthToken('NEWER_TOKEN');
      throw new DfxApiError(409, 'CONFLICT', 'Address belongs to another user');
    });

    await expect(dfxAuthService.linkAddress('bc1qabc', async () => 'SIG')).rejects.toThrow(
      /Address belongs to another user/,
    );

    expect(dfxAuthService.getAccessToken()).toBe('NEWER_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('NEWER_TOKEN');
  });

  it('rejects a link that succeeds after the session was cleared', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setAuthToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockImplementationOnce(async () => {
      dfxApi.clearAuthToken();
      return { accessToken: 'LATE_TOKEN' };
    });

    await expect(dfxAuthService.linkAddress('bc1qabc', async () => 'SIG')).rejects.toThrow(
      'Session changed while linking an address.',
    );

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OLD_TOKEN');
    postSpy.mockRestore();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    } as unknown as Response);
    await expect(
      dfxApi.post('/v1/auth', { address: 'bc1qabc' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
  });

  it('does not post when the session changes while signing', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setAuthToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign the session-change case' });

    await expect(
      dfxAuthService.linkAddress('bc1qsessionchange', async () => {
        dfxApi.setAuthToken('other');
        return 'SIG';
      }),
    ).rejects.toThrow('Session changed while linking an address.');

    expect(postSpy).not.toHaveBeenCalled();
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('other');
  });
});

describe('dfxAuthService.linkLnurlAddress', () => {
  let postSpy: jest.SpyInstance;
  let setAuthTokenSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(dfxApi, 'post');
    setAuthTokenSpy = jest.spyOn(dfxApi, 'setAuthToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxAuthService.adoptStoredToken(null);
  });

  it('throws when no session is active', async () => {
    dfxAuthService.adoptStoredToken(null);
    await expect(dfxAuthService.linkLnurlAddress('lnurl1abc', 'OWNERSHIP_PROOF')).rejects.toThrow(
      /Not authenticated/,
    );
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('skips signMessage and posts the uppercase LNURL with static ownership proof', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    const getSpy = jest.spyOn(dfxApi, 'get');
    postSpy.mockResolvedValueOnce({ accessToken: 'LIGHTNING_TOKEN' });

    const newToken = await dfxAuthService.linkLnurlAddress('lnurl1abc', 'OWNERSHIP_PROOF', {
      wallet: 'DFX Bitcoin',
      blockchain: 'Lightning',
    });

    // No signMessage challenge — Lightning auth at DFX uses the pre-signed
    // proof directly. The address must be uppercased because DFX's DTO
    // validator only accepts `(LNURL|LNDHUB)[A-Z0-9]{25,250}`.
    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: 'LNURL1ABC',
        signature: 'OWNERSHIP_PROOF',
        wallet: 'DFX Bitcoin',
        blockchain: 'Lightning',
      },
      { requireAuth: true },
    );
    expect(newToken).toBe('LIGHTNING_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('LIGHTNING_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('LIGHTNING_TOKEN');
  });

  it('leaves the access token and api token unchanged when DFX rejects the proof', async () => {
    // Same reason as the linkAddress failure test: no api token, so a guarded
    // setAuthToken(previousToken) would bump the generation.
    dfxApi.clearAuthToken();
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    const generation = await captureAuthGeneration();
    postSpy.mockRejectedValueOnce(new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature'));

    await expect(
      dfxAuthService.linkLnurlAddress('lnurl1abc', 'BAD_PROOF', { blockchain: 'Lightning' }),
    ).rejects.toThrow(/Invalid signature/);

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    postSpy.mockRestore();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    } as unknown as Response);
    await expect(
      dfxApi.post('/v1/auth', { address: 'LNURL1ABC' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
    expect(dfxApi.setAuthTokenForRefresh('NEW', generation)).toBe(true);
  });

  it('defaults the wallet hint to "DFX Bitcoin" when none is given', async () => {
    dfxAuthService.adoptStoredToken('OLD');
    postSpy.mockResolvedValueOnce({ accessToken: 'NEW' });

    await dfxAuthService.linkLnurlAddress('lnurl1', 'PROOF');

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: 'LNURL1',
        signature: 'PROOF',
        wallet: 'DFX Bitcoin',
      },
      { requireAuth: true },
    );
  });

  it('rejects a link while a refresh has cleared the api token and does not log in', async () => {
    postSpy.mockRestore();
    const { fetchSpy } = await clearApiTokenForInFlightRefresh('OLD_TOKEN');

    await expect(dfxAuthService.linkLnurlAddress('lnurl1abc', 'OWNERSHIP_PROOF')).rejects.toThrow(
      'Authentication required',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
  });

  it('does not sabotage a refresh that cleared the api token', async () => {
    postSpy.mockRestore();
    const { generation } = await clearApiTokenForInFlightRefresh('OLD_TOKEN');

    await expect(dfxAuthService.linkLnurlAddress('lnurl1abc', 'OWNERSHIP_PROOF')).rejects.toThrow(
      'Authentication required',
    );

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    await expect(
      dfxApi.post('/v1/auth', { address: 'LNURL1ABC' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
    expect(dfxApi.setAuthTokenForRefresh('REFRESHED', generation)).toBe(true);
  });

  it('does not restore the previous token when the session was replaced while linking', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockImplementationOnce(async () => {
      dfxAuthService.adoptStoredToken('NEWER_TOKEN');
      dfxApi.setAuthToken('NEWER_TOKEN');
      throw new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature');
    });

    await expect(
      dfxAuthService.linkLnurlAddress('lnurl1abc', 'BAD_PROOF', { blockchain: 'Lightning' }),
    ).rejects.toThrow(/Invalid signature/);

    expect(dfxAuthService.getAccessToken()).toBe('NEWER_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('NEWER_TOKEN');
  });

  it('rejects a link that succeeds after another session was set', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setAuthToken('OLD_TOKEN');
    postSpy.mockImplementationOnce(async () => {
      dfxApi.setAuthToken('other');
      return { accessToken: 'LATE_TOKEN' };
    });

    await expect(dfxAuthService.linkLnurlAddress('lnurl1abc', 'OWNERSHIP_PROOF')).rejects.toThrow(
      'Session changed while linking an address.',
    );

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('other');
    postSpy.mockRestore();
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    } as unknown as Response);
    await dfxApi.post('/v1/auth', { address: 'LNURL1ABC' }, { requireAuth: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer other' }),
      }),
    );
  });
});

describe('dfxAuthService.adoptStoredToken', () => {
  afterEach(() => {
    dfxAuthService.adoptStoredToken(null);
  });

  it('makes the rehydrated token visible to subsequent linkAddress calls', () => {
    dfxAuthService.adoptStoredToken('STORED');
    expect(dfxAuthService.isAuthenticated()).toBe(true);
    expect(dfxAuthService.getAccessToken()).toBe('STORED');
  });

  it('clears the in-memory token when called with null', () => {
    dfxAuthService.adoptStoredToken('STORED');
    dfxAuthService.adoptStoredToken(null);
    expect(dfxAuthService.isAuthenticated()).toBe(false);
    expect(dfxAuthService.getAccessToken()).toBeNull();
  });
});

describe('dfxAuthService signature cache', () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    dfxAuthService.logout(); // start from an empty signature cache (singleton)
    getSpy = jest.spyOn(dfxApi, 'get');
    postSpy = jest.spyOn(dfxApi, 'post');
    jest.spyOn(dfxApi, 'setAuthToken').mockImplementation(() => {});
    jest.spyOn(dfxApi, 'clearAuthToken').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    dfxAuthService.logout();
  });

  it('reuses a cached signature for the same address+challenge within TTL', async () => {
    getSpy.mockResolvedValue({ message: 'same-challenge' });
    postSpy.mockResolvedValue({ accessToken: 'T' });
    const signFn = jest.fn().mockResolvedValue('SIG');

    await dfxAuthService.login('0xabc', signFn);
    await dfxAuthService.login('0xabc', signFn); // identical challenge, inside TTL

    // The wallet/biometric sign path must run only once — the second login
    // serves the cached signature.
    expect(signFn).toHaveBeenCalledTimes(1);
  });

  it('re-signs once the cached signature is past the 5-minute TTL', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    getSpy.mockResolvedValue({ message: 'same-challenge' });
    postSpy.mockResolvedValue({ accessToken: 'T' });
    const signFn = jest.fn().mockResolvedValue('SIG');

    await dfxAuthService.login('0xabc', signFn);
    jest.setSystemTime(new Date('2026-01-01T00:05:01Z')); // TTL is 5 minutes
    await dfxAuthService.login('0xabc', signFn);

    expect(signFn).toHaveBeenCalledTimes(2);
  });

  it('re-signs when the challenge string changes for the same address', async () => {
    getSpy.mockResolvedValueOnce({ message: 'challenge-1' });
    getSpy.mockResolvedValueOnce({ message: 'challenge-2' });
    postSpy.mockResolvedValue({ accessToken: 'T' });
    const signFn = jest.fn().mockResolvedValue('SIG');

    await dfxAuthService.login('0xabc', signFn);
    await dfxAuthService.login('0xabc', signFn);

    expect(signFn).toHaveBeenCalledTimes(2);
  });

  it('forgets cached signatures on logout', async () => {
    getSpy.mockResolvedValue({ message: 'same-challenge' });
    postSpy.mockResolvedValue({ accessToken: 'T' });
    const signFn = jest.fn().mockResolvedValue('SIG');

    await dfxAuthService.login('0xabc', signFn);
    dfxAuthService.logout();
    expect(dfxAuthService.isAuthenticated()).toBe(false); // token gone right after logout
    await dfxAuthService.login('0xabc', signFn);

    expect(signFn).toHaveBeenCalledTimes(2); // cache was cleared, so it re-signed
  });

  it('does not restore a Bearer when a login without prior session fails', async () => {
    dfxAuthService.logout(); // no previous token
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockRejectedValueOnce(new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature'));
    const setAuthTokenSpy = jest.spyOn(dfxApi, 'setAuthToken');

    await expect(dfxAuthService.login('0xabc', async () => 'SIG')).rejects.toThrow(
      /Invalid signature/,
    );

    // previousToken was null → the catch must NOT re-set a Bearer.
    expect(setAuthTokenSpy).not.toHaveBeenCalled();
    expect(dfxAuthService.getAccessToken()).toBeNull();
  });
});

describe('dfxAuthService.changeActiveAddress', () => {
  let postSpy: jest.SpyInstance;
  let setAuthTokenSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(dfxApi, 'post');
    setAuthTokenSpy = jest.spyOn(dfxApi, 'setAuthToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxApi.setOnUnauthorized(async () => null);
    dfxAuthService.logout();
  });

  it('throws without re-signing when no session is active', async () => {
    dfxAuthService.adoptStoredToken(null);
    await expect(dfxAuthService.changeActiveAddress('0xother')).rejects.toThrow(
      /Not authenticated/,
    );
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('switches to a linked address via /v1/user/change without a signature', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockResolvedValueOnce({ accessToken: 'SWITCHED_TOKEN' });

    const token = await dfxAuthService.changeActiveAddress('0xother');

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/user/change',
      { address: '0xother' },
      { requireAuth: true },
    );
    expect(token).toBe('SWITCHED_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('SWITCHED_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('SWITCHED_TOKEN');
  });

  it('leaves the session token and generation unchanged when the switch fails', async () => {
    // setAuthToken bumps the generation unless the api token is already equal.
    // Start with no api token so a guarded restore would show up here.
    dfxApi.clearAuthToken();
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    const generation = await captureAuthGeneration();
    postSpy.mockRejectedValueOnce(new DfxApiError(403, 'FORBIDDEN', 'Address not on account'));

    await expect(dfxAuthService.changeActiveAddress('0xother')).rejects.toThrow(
      /Address not on account/,
    );

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    postSpy.mockRestore();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    } as unknown as Response);
    await expect(
      dfxApi.post('/v1/user/change', { address: '0xother' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
    expect(dfxApi.setAuthTokenForRefresh('NEW', generation)).toBe(true);
  });

  it('rejects a switch while a refresh has cleared the api token and does not send it', async () => {
    postSpy.mockRestore();
    const { fetchSpy, generation } = await clearApiTokenForInFlightRefresh('OLD_TOKEN');

    await expect(dfxAuthService.changeActiveAddress('0xother')).rejects.toThrow(
      'Authentication required',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    await expect(
      dfxApi.post('/v1/user/change', { address: '0xother' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
    expect(dfxApi.setAuthTokenForRefresh('REFRESHED', generation)).toBe(true);
  });

  it('keeps a concurrently refreshed Bearer when the retried switch fails', async () => {
    postSpy.mockRestore();
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setAuthToken('OLD_TOKEN');
    dfxApi.setOnUnauthorized(async () => {
      dfxAuthService.adoptStoredToken('REFRESHED_TOKEN');
      dfxApi.setAuthToken('REFRESHED_TOKEN');
      return 'REFRESHED_TOKEN';
    });
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Expired' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ statusCode: 403, code: 'FORBIDDEN', message: 'Not linked' }),
      } as unknown as Response);

    await expect(dfxAuthService.changeActiveAddress('0xother')).rejects.toThrow('Not linked');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(dfxAuthService.getAccessToken()).toBe('REFRESHED_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('REFRESHED_TOKEN');
  });

  it('rejects a switch that succeeds after the session was cleared', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    dfxApi.setAuthToken('OLD_TOKEN');
    postSpy.mockImplementationOnce(async () => {
      dfxApi.clearAuthToken();
      return { accessToken: 'LATE_TOKEN' };
    });

    await expect(dfxAuthService.changeActiveAddress('0xother')).rejects.toThrow(
      'Session changed while switching addresses.',
    );

    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OLD_TOKEN');
    postSpy.mockRestore();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    } as unknown as Response);
    await expect(
      dfxApi.post('/v1/user/change', { address: '0xother' }, { requireAuth: true }),
    ).rejects.toThrow('Authentication required');
  });
});

describe('dfxAuthService.loginAsLnurlAddressOwner', () => {
  let postSpy: jest.SpyInstance;
  let getSpy: jest.SpyInstance;
  let setAuthTokenSpy: jest.SpyInstance;
  let clearAuthTokenSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(dfxApi, 'post');
    getSpy = jest.spyOn(dfxApi, 'get');
    setAuthTokenSpy = jest.spyOn(dfxApi, 'setAuthToken');
    clearAuthTokenSpy = jest.spyOn(dfxApi, 'clearAuthToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxAuthService.logout();
  });

  it('drops the current Bearer and re-auths as the LNURL owner (uppercased, no challenge)', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockResolvedValueOnce({ accessToken: 'OWNER_TOKEN' });

    const token = await dfxAuthService.loginAsLnurlAddressOwner('lnurl1abc', 'PROOF', {
      blockchain: 'Lightning',
    });

    expect(clearAuthTokenSpy).toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: 'LNURL1ABC',
        signature: 'PROOF',
        wallet: 'DFX Bitcoin',
        blockchain: 'Lightning',
      },
      { anonymous: true },
    );
    expect(token).toBe('OWNER_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OWNER_TOKEN');
  });

  it('restores the previous token when the proof is rejected', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockRejectedValueOnce(new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature'));

    await expect(dfxAuthService.loginAsLnurlAddressOwner('lnurl1', 'BAD')).rejects.toThrow(
      /Invalid signature/,
    );

    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OLD_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
  });

  it('does not restore a Bearer on failure when there was no prior session', async () => {
    dfxAuthService.logout(); // no previous token
    postSpy.mockRejectedValueOnce(new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature'));

    await expect(dfxAuthService.loginAsLnurlAddressOwner('lnurl1', 'BAD')).rejects.toThrow(
      /Invalid signature/,
    );

    expect(setAuthTokenSpy).not.toHaveBeenCalled();
    expect(dfxAuthService.getAccessToken()).toBeNull();
  });

  it('does not restore the previous token when a session was adopted during the login', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockImplementationOnce(async () => {
      dfxAuthService.adoptStoredToken('NEWER_TOKEN');
      dfxApi.setAuthToken('NEWER_TOKEN');
      throw new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature');
    });

    await expect(dfxAuthService.loginAsLnurlAddressOwner('lnurl1', 'BAD')).rejects.toThrow(
      /Invalid signature/,
    );

    expect(dfxAuthService.getAccessToken()).toBe('NEWER_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('NEWER_TOKEN');
  });
});

describe('dfxAuthService delegating helpers', () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;
  let clearAuthTokenForRefreshSpy: jest.SpyInstance;
  let setAuthTokenForRefreshSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(dfxApi, 'get');
    postSpy = jest.spyOn(dfxApi, 'post');
    jest.spyOn(dfxApi, 'setAuthToken').mockImplementation(() => {});
    jest.spyOn(dfxApi, 'clearAuthToken').mockImplementation(() => {});
    clearAuthTokenForRefreshSpy = jest
      .spyOn(dfxApi, 'clearAuthTokenForRefresh')
      .mockReturnValue(true);
    setAuthTokenForRefreshSpy = jest.spyOn(dfxApi, 'setAuthTokenForRefresh').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxAuthService.logout();
  });

  it('forwards the usedRef hint to /v1/auth when provided', async () => {
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'T' });

    await dfxAuthService.login('0xabc', async () => 'SIG', { usedRef: 'PARTNER_REF' });

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: '0xabc',
        signature: 'SIG',
        wallet: 'DFX Wallet',
        usedRef: 'PARTNER_REF',
      },
      { anonymous: true },
    );
  });

  it('refresh runs a fresh signature login', async () => {
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'REFRESHED' });
    const signFn = jest.fn().mockResolvedValue('SIG');

    const token = await dfxAuthService.refresh('0xabc', signFn);

    expect(signFn).toHaveBeenCalledWith('sign me');
    expect(token).toBe('REFRESHED');
  });

  it('uses generation-bound token updates for a 401 refresh', async () => {
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'REFRESHED' });

    const token = await dfxAuthService.refresh('0xabc', async () => 'SIG', 7);

    expect(token).toBe('REFRESHED');
    expect(clearAuthTokenForRefreshSpy).toHaveBeenCalledWith(7);
    expect(setAuthTokenForRefreshSpy).toHaveBeenCalledWith('REFRESHED', 7);
    expect(dfxApi.clearAuthToken).not.toHaveBeenCalled();
    expect(dfxApi.setAuthToken).not.toHaveBeenCalled();
  });

  it('rejects a refresh whose auth generation is already stale', async () => {
    clearAuthTokenForRefreshSpy.mockReturnValueOnce(false);

    await expect(dfxAuthService.refresh('0xabc', async () => 'SIG', 7)).rejects.toThrow(
      'Authentication changed before token refresh started.',
    );
    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('does not adopt a refresh token after the auth generation changes', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'STALE_TOKEN' });
    setAuthTokenForRefreshSpy.mockReturnValue(false);

    await expect(dfxAuthService.refresh('0xabc', async () => 'SIG', 7)).rejects.toThrow(
      'Authentication changed while token refresh was pending.',
    );
    expect(setAuthTokenForRefreshSpy).toHaveBeenNthCalledWith(1, 'STALE_TOKEN', 7);
    expect(setAuthTokenForRefreshSpy).toHaveBeenNthCalledWith(2, 'OLD_TOKEN', 7);
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
  });

  it('loginAsAddressOwner re-auths with the given options', async () => {
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'OWNER' });

    const token = await dfxAuthService.loginAsAddressOwner('0xabc', async () => 'SIG', {
      blockchain: 'Ethereum',
    });

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth',
      {
        address: '0xabc',
        signature: 'SIG',
        wallet: 'DFX Wallet',
        blockchain: 'Ethereum',
      },
      { anonymous: true },
    );
    expect(token).toBe('OWNER');
  });
});

describe('dfxAuthService mail login', () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;
  let setAuthTokenSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(dfxApi, 'get');
    postSpy = jest.spyOn(dfxApi, 'post');
    setAuthTokenSpy = jest.spyOn(dfxApi, 'setAuthToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxAuthService.logout();
  });

  it('requests a mail login with only the provided optional fields', async () => {
    postSpy.mockResolvedValueOnce(undefined);

    await dfxAuthService.requestMailLogin('user@example.com', { redirectUri: 'app://back' });

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth/mail',
      {
        mail: 'user@example.com',
        redirectUri: 'app://back',
      },
      { requireAuth: true },
    );
  });

  it('sends a bare mail request when no options are given', async () => {
    postSpy.mockResolvedValueOnce(undefined);

    await dfxAuthService.requestMailLogin('user@example.com');

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth/mail',
      { mail: 'user@example.com' },
      { requireAuth: true },
    );
  });

  it('forwards wallet and recommendationCode hints when provided', async () => {
    postSpy.mockResolvedValueOnce(undefined);

    await dfxAuthService.requestMailLogin('user@example.com', {
      wallet: 'DFX Wallet',
      recommendationCode: 'REF123',
    });

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/auth/mail',
      {
        mail: 'user@example.com',
        wallet: 'DFX Wallet',
        recommendationCode: 'REF123',
      },
      { requireAuth: true },
    );
  });

  it('rejects a mail login while a refresh has cleared the api token and does not send it', async () => {
    getSpy.mockRestore();
    postSpy.mockRestore();
    const { fetchSpy } = await clearApiTokenForInFlightRefresh('SESSION_TOKEN');

    await expect(dfxAuthService.requestMailLogin('user@example.com')).rejects.toThrow(
      'Authentication required',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dfxAuthService.getAccessToken()).toBe('SESSION_TOKEN');
  });

  it('sends the session bearer when the api token is set', async () => {
    postSpy.mockRestore();
    dfxAuthService.adoptStoredToken('SESSION_TOKEN');
    dfxApi.setAuthToken('SESSION_TOKEN');
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    } as unknown as Response);

    await dfxAuthService.requestMailLogin('user@example.com', { wallet: 'DFX Wallet' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.dfx.swiss/v1/auth/mail',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer SESSION_TOKEN' }),
      }),
    );
  });

  it('exchanges the URL-encoded otp for a token and adopts it', async () => {
    getSpy.mockResolvedValueOnce({ accessToken: 'MAIL_TOKEN' });

    const token = await dfxAuthService.confirmMailLogin('a b/c+d');

    expect(getSpy).toHaveBeenCalledWith('/v1/auth/mail/confirm?code=a%20b%2Fc%2Bd', {
      anonymous: true,
    });
    expect(token).toBe('MAIL_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('MAIL_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('MAIL_TOKEN');
  });

  it('exchanges the otp without sending a standing bearer', async () => {
    getSpy.mockRestore();
    dfxApi.setAuthToken('SESSION_TOKEN');
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ accessToken: 'MAIL_TOKEN' }),
    } as unknown as Response);

    const token = await dfxAuthService.confirmMailLogin('otp-code');

    expect(token).toBe('MAIL_TOKEN');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.dfx.swiss/v1/auth/mail/confirm?code=otp-code',
      expect.objectContaining({
        method: 'GET',
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
    expect(dfxAuthService.getAccessToken()).toBe('MAIL_TOKEN');
  });
});
