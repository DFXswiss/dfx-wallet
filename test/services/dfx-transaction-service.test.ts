/**
 * Wire-contract tests for DfxTransactionService: the authenticated history
 * feed and the two-step CSV tax export (authed PUT issues a single-use file
 * key, public GET consumes it).
 */
import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import {
  dfxTransactionService,
  type TransactionDto,
} from '../../src/features/dfx-backend/services/transaction-service';
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

function call(index = 0): { url: string; init: RequestInit } {
  const c = fetchMock.mock.calls[index];
  if (!c) throw new Error(`fetch call ${index} was not made`);
  return { url: c[0], init: c[1] ?? {} };
}

const TXS: TransactionDto[] = [
  {
    id: 1,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 100,
    inputAsset: 'EUR',
    outputAmount: 0.001,
    outputAsset: 'BTC',
    date: '2025-05-01T10:00:00.000Z',
    txId: 'abc123',
  },
  {
    id: 2,
    type: 'Sell',
    state: 'Processing',
    inputAmount: 0.5,
    inputAsset: 'ETH',
    outputAmount: 1200,
    outputAsset: 'CHF',
    date: '2025-05-02T11:00:00.000Z',
  },
];

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  dfxApi.setAuthToken('TEST_TOKEN');
  dfxApi.setOnUnauthorized(async () => null);
});

afterEach(() => {
  dfxApi.clearAuthToken();
});

describe('dfxTransactionService.getTransactions', () => {
  it('GETs /v1/transaction/detail authenticated and returns the rows', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(TXS));

    const txs = await dfxTransactionService.getTransactions();

    expect(txs).toEqual(TXS);
    const { url, init } = call();
    expect(url).toBe(`${BASE}/v1/transaction/detail`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TEST_TOKEN',
    });
    expect(init).not.toHaveProperty('body');
  });

  it('returns an empty history as an empty array', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk([]));

    await expect(dfxTransactionService.getTransactions()).resolves.toEqual([]);
  });

  it('passes rows with missing amounts/types through unvalidated', async () => {
    // NOTE: passes through unvalidated — a row without outputAmount/state is
    // delivered to the UI as-is. Funds-affecting display values (amounts)
    // can surface as undefined/NaN with no controlled failure here.
    const hostile = [{ id: 3, type: 'Buy' }];
    fetchMock.mockResolvedValueOnce(jsonOk(hostile));

    await expect(dfxTransactionService.getTransactions()).resolves.toEqual(hostile);
  });

  it('passes a JSON null body through instead of failing controlled', async () => {
    // NOTE: passes through unvalidated — null is returned as the
    // TransactionDto[]; callers calling .map() on it crash.
    fetchMock.mockResolvedValueOnce(jsonOk(null));

    await expect(dfxTransactionService.getTransactions()).resolves.toBeNull();
  });

  it('propagates a 401 as DfxApiError when no refresh is possible', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Token expired' }, 401),
    );

    const err = await dfxTransactionService.getTransactions().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(401);
  });

  it('propagates network-level rejections unchanged', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(dfxTransactionService.getTransactions()).rejects.toThrow(
      'Network request failed',
    );
  });
});

describe('dfxTransactionService.createCsvExport', () => {
  it('PUTs the filters in the query string with ISO dates URL-encoded and an empty-object body', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk('0123abcd4567efgh'));

    const result = await dfxTransactionService.createCsvExport({
      from: new Date('2025-01-01T00:00:00.000Z'),
      to: new Date('2025-03-31T23:59:59.999Z'),
      type: 'ChainReport',
    });

    const { url, init } = call();
    expect(url).toBe(
      `${BASE}/v1/transaction/csv?from=2025-01-01T00%3A00%3A00.000Z&to=2025-03-31T23%3A59%3A59.999Z&type=ChainReport`,
    );
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer TEST_TOKEN',
    });
    expect(init.body).toBe('{}');
    expect(result.fileKey).toBe('0123abcd4567efgh');
    expect(result.downloadUrl).toBe(`${BASE}/v1/transaction/csv?key=0123abcd4567efgh`);
  });

  it('defaults the report type to CoinTracking and omits absent date filters', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk('key1'));

    await dfxTransactionService.createCsvExport({});

    expect(call().url).toBe(`${BASE}/v1/transaction/csv?type=CoinTracking`);
  });

  it('sends only the provided bound when the range is half-open', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk('key1'));

    await dfxTransactionService.createCsvExport({
      from: new Date('2025-06-01T00:00:00.000Z'),
      type: 'Compact',
    });

    expect(call().url).toBe(
      `${BASE}/v1/transaction/csv?from=2025-06-01T00%3A00%3A00.000Z&type=Compact`,
    );
  });

  it('URL-encodes the returned file key when building the public download URL', async () => {
    // The key is server-controlled input that gets embedded into a URL —
    // encodeURIComponent must neutralize separators so a hostile key cannot
    // smuggle extra query parameters into the download request.
    fetchMock.mockResolvedValueOnce(jsonOk('a+b/c=&d?e'));

    const result = await dfxTransactionService.createCsvExport({});

    expect(result.downloadUrl).toBe(
      `${BASE}/v1/transaction/csv?key=a%2Bb%2Fc%3D%26d%3Fe`,
    );
  });

  it('turns an empty 200 body into fileKey undefined and a key=undefined URL', async () => {
    // NOTE: passes through unvalidated — an empty success response yields
    // { fileKey: undefined, downloadUrl: ".../csv?key=undefined" } instead
    // of a controlled failure. The caller would hand a dead URL to the
    // share sheet.
    fetchMock.mockResolvedValueOnce(jsonOk(undefined));

    const result = await dfxTransactionService.createCsvExport({});

    expect(result.fileKey).toBeUndefined();
    expect(result.downloadUrl).toBe(`${BASE}/v1/transaction/csv?key=undefined`);
  });

  it('passes a non-string file key through unvalidated', async () => {
    // NOTE: passes through unvalidated — a numeric body becomes a numeric
    // fileKey typed as string; an object body would yield key=[object Object].
    fetchMock.mockResolvedValueOnce(jsonOk(12345));

    const result = await dfxTransactionService.createCsvExport({});

    expect(result.fileKey).toBe(12345 as unknown as string);
    expect(result.downloadUrl).toBe(`${BASE}/v1/transaction/csv?key=12345`);
  });

  it('propagates a structured 4xx as DfxApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 400, code: 'INVALID_RANGE', message: 'from after to' }, 400),
    );

    const err = await dfxTransactionService
      .createCsvExport({ from: new Date('2025-02-01'), to: new Date('2025-01-01') })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).code).toBe('INVALID_RANGE');
  });

  it('falls back to UNKNOWN on a non-JSON 5xx body', async () => {
    fetchMock.mockResolvedValueOnce(httpResponse(503, 'Service Unavailable'));

    const err = await dfxTransactionService.createCsvExport({}).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(503);
    expect((err as DfxApiError).code).toBe('UNKNOWN');
  });
});
