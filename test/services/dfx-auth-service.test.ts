import { dfxApi, DfxApiError } from '../../src/services/dfx/api';
import { dfxAuthService } from '../../src/services/dfx/auth-service';

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
    await expect(
      dfxAuthService.linkLnurlAddress('lnurl1abc', 'OWNERSHIP_PROOF'),
    ).rejects.toThrow(/Not authenticated/);
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
    postSpy.mockRejectedValueOnce(
      new DfxApiError(400, 'AUTH_FAILED', 'Invalid signature'),
    );

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
