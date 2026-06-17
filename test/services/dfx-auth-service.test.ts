import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import { dfxAuthService } from '../../src/features/dfx-backend/services/auth-service';

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
    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: '0xabc',
      signature: 'SIG',
      wallet: 'DFX Wallet',
    });
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
    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: 'bc1qabc',
      signature: 'SIGNATURE',
      wallet: 'DFX Wallet',
      blockchain: 'Bitcoin',
    });
    expect(newToken).toBe('NEW_TOKEN');
    // The fresh JWT must replace the old one so /buy/quote stops returning
    // "Asset blockchain mismatch" — this was the regression we fixed.
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('NEW_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('NEW_TOKEN');
  });

  it('restores the previous token when /v1/auth fails', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockRejectedValueOnce(
      new DfxApiError(409, 'CONFLICT', 'Address belongs to another user'),
    );

    await expect(
      dfxAuthService.linkAddress('bc1qabc', async () => 'SIG', { blockchain: 'Bitcoin' }),
    ).rejects.toThrow(/Address belongs to another user/);

    // The old token must come back so the user stays signed in as their
    // primary address even when linking the secondary one fails.
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OLD_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
  });

  it('omits the blockchain hint when none is provided', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'NEW' });

    await dfxAuthService.linkAddress('addr', async () => 'SIG');

    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: 'addr',
      signature: 'SIG',
      wallet: 'DFX Wallet',
    });
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
    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: 'LNURL1ABC',
      signature: 'OWNERSHIP_PROOF',
      wallet: 'DFX Bitcoin',
      blockchain: 'Lightning',
    });
    expect(newToken).toBe('LIGHTNING_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('LIGHTNING_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('LIGHTNING_TOKEN');
  });

  it('restores the previous token when DFX rejects the proof', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockRejectedValueOnce(new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature'));

    await expect(
      dfxAuthService.linkLnurlAddress('lnurl1abc', 'BAD_PROOF', { blockchain: 'Lightning' }),
    ).rejects.toThrow(/Invalid signature/);

    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OLD_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
  });

  it('defaults the wallet hint to "DFX Bitcoin" when none is given', async () => {
    dfxAuthService.adoptStoredToken('OLD');
    postSpy.mockResolvedValueOnce({ accessToken: 'NEW' });

    await dfxAuthService.linkLnurlAddress('lnurl1', 'PROOF');

    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: 'LNURL1',
      signature: 'PROOF',
      wallet: 'DFX Bitcoin',
    });
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
    dfxAuthService.logout();
  });

  it('throws without re-signing when no session is active', async () => {
    dfxAuthService.adoptStoredToken(null);
    await expect(dfxAuthService.changeActiveAddress('0xother')).rejects.toThrow(
      /Not authenticated/,
    );
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('switches to a linked address via /v2/user/change without a signature', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockResolvedValueOnce({ accessToken: 'SWITCHED_TOKEN' });

    const token = await dfxAuthService.changeActiveAddress('0xother');

    expect(postSpy).toHaveBeenCalledWith('/v2/user/change', { address: '0xother' });
    expect(token).toBe('SWITCHED_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('SWITCHED_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('SWITCHED_TOKEN');
  });

  it('restores the previous Bearer when the switch fails', async () => {
    dfxAuthService.adoptStoredToken('OLD_TOKEN');
    postSpy.mockRejectedValueOnce(new DfxApiError(403, 'FORBIDDEN', 'Address not on account'));

    await expect(dfxAuthService.changeActiveAddress('0xother')).rejects.toThrow(
      /Address not on account/,
    );

    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('OLD_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('OLD_TOKEN');
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
    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: 'LNURL1ABC',
      signature: 'PROOF',
      wallet: 'DFX Bitcoin',
      blockchain: 'Lightning',
    });
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
});

describe('dfxAuthService delegating helpers', () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(dfxApi, 'get');
    postSpy = jest.spyOn(dfxApi, 'post');
    jest.spyOn(dfxApi, 'setAuthToken').mockImplementation(() => {});
    jest.spyOn(dfxApi, 'clearAuthToken').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dfxAuthService.logout();
  });

  it('forwards the usedRef hint to /v1/auth when provided', async () => {
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'T' });

    await dfxAuthService.login('0xabc', async () => 'SIG', { usedRef: 'PARTNER_REF' });

    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: '0xabc',
      signature: 'SIG',
      wallet: 'DFX Wallet',
      usedRef: 'PARTNER_REF',
    });
  });

  it('refresh runs a fresh signature login', async () => {
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'REFRESHED' });
    const signFn = jest.fn().mockResolvedValue('SIG');

    const token = await dfxAuthService.refresh('0xabc', signFn);

    expect(signFn).toHaveBeenCalledWith('sign me');
    expect(token).toBe('REFRESHED');
  });

  it('loginAsAddressOwner re-auths with the given options', async () => {
    getSpy.mockResolvedValueOnce({ message: 'sign me' });
    postSpy.mockResolvedValueOnce({ accessToken: 'OWNER' });

    const token = await dfxAuthService.loginAsAddressOwner('0xabc', async () => 'SIG', {
      blockchain: 'Ethereum',
    });

    expect(postSpy).toHaveBeenCalledWith('/v1/auth', {
      address: '0xabc',
      signature: 'SIG',
      wallet: 'DFX Wallet',
      blockchain: 'Ethereum',
    });
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

    expect(postSpy).toHaveBeenCalledWith('/v1/auth/mail', {
      mail: 'user@example.com',
      redirectUri: 'app://back',
    });
  });

  it('sends a bare mail request when no options are given', async () => {
    postSpy.mockResolvedValueOnce(undefined);

    await dfxAuthService.requestMailLogin('user@example.com');

    expect(postSpy).toHaveBeenCalledWith('/v1/auth/mail', { mail: 'user@example.com' });
  });

  it('forwards wallet and recommendationCode hints when provided', async () => {
    postSpy.mockResolvedValueOnce(undefined);

    await dfxAuthService.requestMailLogin('user@example.com', {
      wallet: 'DFX Wallet',
      recommendationCode: 'REF123',
    });

    expect(postSpy).toHaveBeenCalledWith('/v1/auth/mail', {
      mail: 'user@example.com',
      wallet: 'DFX Wallet',
      recommendationCode: 'REF123',
    });
  });

  it('exchanges the URL-encoded otp for a token and adopts it', async () => {
    getSpy.mockResolvedValueOnce({ accessToken: 'MAIL_TOKEN' });

    const token = await dfxAuthService.confirmMailLogin('a b/c+d');

    expect(getSpy).toHaveBeenCalledWith('/v1/auth/mail/confirm?code=a%20b%2Fc%2Bd');
    expect(token).toBe('MAIL_TOKEN');
    expect(setAuthTokenSpy).toHaveBeenLastCalledWith('MAIL_TOKEN');
    expect(dfxAuthService.getAccessToken()).toBe('MAIL_TOKEN');
  });
});
