/**
 * Wire-contract tests for DfxFiatService. /v1/fiat feeds the buy/sell flow
 * with the currency ids that end up in payment payloads, so the lookup and
 * caching semantics are funds-relevant: a wrong or stale id routes money to
 * the wrong currency leg.
 */
import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import { dfxFiatService, type DfxFiat } from '../../src/features/dfx-backend/services/fiat-service';
import { env } from '../../src/config/env';

const BASE = env.dfxApiUrl;

function httpResponse(status: number, bodyText: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText) as unknown,
  } as unknown as Response;
}

const jsonOk = (body: unknown, status = 200): Response =>
  httpResponse(status, body === undefined ? '' : JSON.stringify(body));

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit | undefined]>();
const realFetch = globalThis.fetch;

const FIATS: DfxFiat[] = [
  { id: 2, name: 'EUR', buyable: true, sellable: true },
  { id: 3, name: 'CHF', buyable: true, sellable: false },
];

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  dfxFiatService.reset();
  // A Bearer is in memory — list() must NOT leak it (see test below).
  dfxApi.setAuthToken('TEST_TOKEN');
});

afterEach(() => {
  dfxApi.clearAuthToken();
  dfxFiatService.reset();
});

describe('dfxFiatService.list', () => {
  it('GETs the public /v1/fiat WITHOUT the Authorization header', async () => {
    // The catalog must stay unauthenticated: DFX filters /v1/fiat per-user
    // when a Bearer is attached, which can hide the currency the buy/sell
    // flow needs. This also pins that the JWT is not leaked unnecessarily.
    fetchMock.mockResolvedValueOnce(jsonOk(FIATS));

    const fiats = await dfxFiatService.list();

    expect(fiats).toEqual(FIATS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/v1/fiat`);
    expect(init?.method).toBe('GET');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init).not.toHaveProperty('body');
  });

  it('caches the catalog for the session and refetches after reset()', async () => {
    fetchMock.mockResolvedValue(jsonOk(FIATS));

    await dfxFiatService.list();
    await dfxFiatService.list();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    dfxFiatService.reset();
    await dfxFiatService.list();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches a FAILED fetch until reset() — a transient error poisons the session', async () => {
    // NOTE: design weakness — the promise (not the value) is cached, so a
    // single network hiccup is replayed to every later caller. Buy/sell
    // stays broken for the whole session until something calls reset().
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(dfxFiatService.list()).rejects.toThrow('Network request failed');

    fetchMock.mockResolvedValueOnce(jsonOk(FIATS));
    await expect(dfxFiatService.list()).rejects.toThrow('Network request failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    dfxFiatService.reset();
    await expect(dfxFiatService.list()).resolves.toEqual(FIATS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with DfxApiError on an HTTP 500', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 500, code: 'SERVER_ERROR', message: 'boom' }, 500),
    );

    const err = await dfxFiatService.list().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(500);
  });

  it('passes hostile element shapes through unvalidated', async () => {
    // NOTE: passes through unvalidated — no schema check on the rows; a
    // string id or missing buyable flag reaches the payment flow as-is.
    const hostile = [{ id: '2', name: 'EUR' }];
    fetchMock.mockResolvedValueOnce(jsonOk(hostile));

    await expect(dfxFiatService.list()).resolves.toEqual(hostile);
  });
});

describe('dfxFiatService.find', () => {
  it('matches the symbol case-insensitively', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(FIATS));

    await expect(dfxFiatService.find('eur')).resolves.toEqual(FIATS[0]);
    await expect(dfxFiatService.find('ChF')).resolves.toEqual(FIATS[1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for unknown symbols, empty input, and untrimmed input', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(FIATS));

    await expect(dfxFiatService.find('JPY')).resolves.toBeUndefined();
    await expect(dfxFiatService.find('')).resolves.toBeUndefined();
    // No trimming: ' EUR' is a different symbol as far as find() cares.
    await expect(dfxFiatService.find(' EUR')).resolves.toBeUndefined();
  });

  it('returns undefined when the catalog is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk([]));

    await expect(dfxFiatService.find('EUR')).resolves.toBeUndefined();
  });

  it('crashes with a raw TypeError when the body is JSON null', async () => {
    // NOTE: passes through unvalidated — list() happily caches `null`, then
    // find() blows up with an uncontrolled TypeError instead of a typed
    // error. The poisoned null also stays cached for the session.
    fetchMock.mockResolvedValueOnce(jsonOk(null));

    await expect(dfxFiatService.find('EUR')).rejects.toThrow(TypeError);
  });

  it('crashes with a raw TypeError when a row is missing `name`', async () => {
    // NOTE: passes through unvalidated — one malformed row in the catalog
    // (name missing) makes every find() throw a TypeError.
    fetchMock.mockResolvedValueOnce(jsonOk([{ id: 2, buyable: true, sellable: true }]));

    await expect(dfxFiatService.find('EUR')).rejects.toThrow(TypeError);
  });
});
