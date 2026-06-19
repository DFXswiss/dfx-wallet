/**
 * Wire-contract tests for DfxUserService. The DFX backend is a trust
 * boundary: these tests pin the exact request contract (URL, method,
 * headers incl. Bearer, body serialization) at the fetch level and
 * document how the client behaves on hostile/malformed responses.
 */
import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import type { UserDto } from '../../src/features/dfx-backend/services/dto';
import { dfxUserService } from '../../src/features/dfx-backend/services/user-service';
import { env } from '../../src/config/env';
import { httpResponse, jsonOk, createDfxFetchMock } from '../helpers/dfx-http';

const BASE = env.dfxApiUrl;

const { fetchMock, realFetch, call } = createDfxFetchMock();

const USER: UserDto = {
  accountId: 7,
  accountType: 'Personal',
  mail: 'user@example.com',
  phone: null,
  language: { id: 1, name: 'English', symbol: 'EN' },
  currency: { id: 2, name: 'EUR' },
  tradingLimit: { limit: 1000, period: 'Day' },
  kyc: { hash: 'abc', level: 20, dataComplete: true },
  volumes: { buy: 0, sell: 0, swap: 0 },
  addresses: [{ address: '0xabc', blockchain: 'Ethereum', blockchains: ['Ethereum'] }],
  activeAddress: { address: '0xabc', blockchain: 'Ethereum', blockchains: ['Ethereum'] },
};

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  dfxApi.setAuthToken('TEST_TOKEN');
  // Default: no refresh available, so 401s surface as DfxApiError.
  dfxApi.setOnUnauthorized(async () => null);
});

afterEach(() => {
  dfxApi.clearAuthToken();
});

describe('dfxUserService happy paths', () => {
  it('getUser issues an authenticated GET /v2/user with no body', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(USER));

    const user = await dfxUserService.getUser();

    expect(user).toEqual(USER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = call();
    expect(url).toBe(`${BASE}/v2/user`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TEST_TOKEN',
    });
    expect(init).not.toHaveProperty('body');
  });

  it('updateUser issues PUT /v2/user with the payload serialized verbatim', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(USER));
    const payload = {
      language: { id: 3, name: 'Deutsch', symbol: 'DE' },
      currency: { id: 2, name: 'EUR' },
    };

    const user = await dfxUserService.updateUser(payload);

    expect(user).toEqual(USER);
    const { url, init } = call();
    expect(url).toBe(`${BASE}/v2/user`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TEST_TOKEN',
    });
    expect(init.body).toBe(JSON.stringify(payload));
  });

  it('updateMail PUTs /v2/user/mail and resolves undefined on the empty 2xx body', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(undefined));

    await expect(dfxUserService.updateMail('user@example.com')).resolves.toBeUndefined();

    const { url, init } = call();
    expect(url).toBe(`${BASE}/v2/user/mail`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ mail: 'user@example.com' }));
  });

  it('verifyMail POSTs /v2/user/mail/verify with the token in the body', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(USER));

    const user = await dfxUserService.verifyMail('123456');

    expect(user).toEqual(USER);
    const { url, init } = call();
    expect(url).toBe(`${BASE}/v2/user/mail/verify`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ token: '123456' }));
  });
});

describe('dfxUserService input edge cases', () => {
  it('sends the mail string verbatim — no trim, no lowercasing, empty string allowed', async () => {
    // NOTE: passes through unvalidated — unlike kyc-service.registerEmail
    // (which lowercases), updateMail forwards whitespace/case untouched and
    // even an empty string reaches the backend. Client-side normalization
    // and validation are entirely absent here.
    fetchMock.mockResolvedValue(jsonOk(undefined));

    await dfxUserService.updateMail('  User@Example.COM ');
    expect(call(0).init.body).toBe(JSON.stringify({ mail: '  User@Example.COM ' }));

    await dfxUserService.updateMail('');
    expect(call(1).init.body).toBe(JSON.stringify({ mail: '' }));
  });
});

describe('dfxUserService 401 handling (token expiry)', () => {
  it('refreshes via setOnUnauthorized, retries once with the new Bearer, and keeps it', async () => {
    const refresh = jest.fn(async () => 'FRESH_TOKEN');
    dfxApi.setOnUnauthorized(refresh);
    fetchMock
      .mockResolvedValueOnce(
        jsonOk({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Token expired' }, 401),
      )
      .mockResolvedValueOnce(jsonOk(USER))
      .mockResolvedValueOnce(jsonOk(USER));

    const user = await dfxUserService.getUser();

    expect(user).toEqual(USER);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(call(0).init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TEST_TOKEN',
    });
    expect(call(1).init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer FRESH_TOKEN',
    });

    // The refreshed token must stick for subsequent requests.
    await dfxUserService.getUser();
    expect(call(2).init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer FRESH_TOKEN',
    });
  });

  it('surfaces the 401 as DfxApiError when the refresh handler yields no token', async () => {
    const refresh = jest.fn(async () => null);
    dfxApi.setOnUnauthorized(refresh);
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Token expired' }, 401),
    );

    const err = await dfxUserService.getUser().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(401);
    expect((err as DfxApiError).code).toBe('UNAUTHORIZED');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once — a second 401 throws instead of looping refreshes', async () => {
    const refresh = jest.fn(async () => 'FRESH_TOKEN');
    dfxApi.setOnUnauthorized(refresh);
    const unauthorized = { statusCode: 401, code: 'UNAUTHORIZED', message: 'still expired' };
    fetchMock
      .mockResolvedValueOnce(jsonOk(unauthorized, 401))
      .mockResolvedValueOnce(jsonOk(unauthorized, 401));

    await expect(dfxUserService.getUser()).rejects.toThrow('still expired');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('dfxUserService HTTP error paths', () => {
  it('maps a structured 400 with message array into a joined DfxApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk(
        { statusCode: 400, code: 'VALIDATION', message: ['mail must be an email', 'mail required'] },
        400,
      ),
    );

    const err = await dfxUserService.updateMail('nope').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(400);
    expect((err as DfxApiError).message).toBe('mail must be an email, mail required');
  });

  it('exposes isKycRequired on 403 KYC_LEVEL_REQUIRED', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 403, code: 'KYC_LEVEL_REQUIRED', message: 'KYC required' }, 403),
    );

    const err = await dfxUserService.getUser().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).isKycRequired).toBe(true);
  });

  it('falls back to UNKNOWN/HTTP 500 when the 5xx body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(httpResponse(500, '<html>Bad Gateway</html>'));

    const err = await dfxUserService.getUser().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(500);
    expect((err as DfxApiError).code).toBe('UNKNOWN');
    expect((err as DfxApiError).message).toBe('HTTP 500');
  });

  it('trusts the error BODY over the HTTP status line — empty JSON body yields undefined fields', async () => {
    // NOTE: contract weakness in api.ts handleResponse — DfxApiError is built
    // from the body's statusCode/code, not response.status. A hostile or
    // misbehaving 500 with body `{}` produces statusCode/code/message all
    // undefined, so status-based handling downstream silently misses it.
    fetchMock.mockResolvedValueOnce(jsonOk({}, 500));

    const err = await dfxUserService.getUser().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBeUndefined();
    expect((err as DfxApiError).code).toBeUndefined();
    expect((err as DfxApiError).message).toBe('');
  });

  it('propagates network-level rejections unchanged', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    const err = await dfxUserService.getUser().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(DfxApiError);
  });
});

describe('dfxUserService malformed response bodies', () => {
  it('passes a JSON null body through as the "user"', async () => {
    // NOTE: passes through unvalidated — getUser resolves with null typed
    // as UserDto; callers reading user.kyc.level would crash at runtime.
    fetchMock.mockResolvedValueOnce(jsonOk(null));

    await expect(dfxUserService.getUser()).resolves.toBeNull();
  });

  it('passes a half-empty object through as the "user"', async () => {
    // NOTE: passes through unvalidated — no schema check, missing
    // tradingLimit/kyc/addresses fields surface as undefined downstream.
    fetchMock.mockResolvedValueOnce(jsonOk({ mail: 'x@y.z' }));

    await expect(dfxUserService.getUser()).resolves.toEqual({ mail: 'x@y.z' });
  });

  it('resolves undefined for an empty 200 body', async () => {
    // NOTE: passes through unvalidated — an empty 200 from a proxy/CDN turns
    // into `undefined as UserDto` instead of a controlled failure.
    fetchMock.mockResolvedValueOnce(jsonOk(undefined));

    await expect(dfxUserService.getUser()).resolves.toBeUndefined();
  });
});
