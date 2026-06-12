/**
 * Wire-contract tests for DfxAssetService. /v1/asset supplies the asset ids
 * that the buy/sell payloads are built from — a wrong match here means funds
 * are routed to the wrong asset/chain, so the (symbol, blockchain) lookup
 * semantics are pinned tightly.
 */
import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import {
  dfxAssetService,
  type DfxAsset,
} from '../../src/features/dfx-backend/services/asset-service';
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

function asset(partial: Partial<DfxAsset> & Pick<DfxAsset, 'id' | 'name' | 'blockchain'>): DfxAsset {
  return {
    uniqueName: `${partial.blockchain}/${partial.name}`,
    category: 'PublicAsset',
    type: 'Token',
    buyable: true,
    sellable: true,
    ...partial,
  };
}

const ASSETS: DfxAsset[] = [
  asset({ id: 11, name: 'BTC', blockchain: 'Bitcoin', type: 'Coin' }),
  asset({ id: 12, name: 'ETH', blockchain: 'Ethereum', type: 'Coin', evmChainId: 1 }),
  // Same symbol on two chains — the blockchain argument must disambiguate.
  asset({ id: 21, name: 'USDT', blockchain: 'Ethereum', evmChainId: 1 }),
  asset({ id: 22, name: 'USDT', blockchain: 'Polygon', evmChainId: 137 }),
];

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  dfxAssetService.reset();
  dfxApi.setAuthToken('TEST_TOKEN');
});

afterEach(() => {
  dfxApi.clearAuthToken();
  dfxAssetService.reset();
});

describe('dfxAssetService.list', () => {
  it('GETs the public /v1/asset WITHOUT the Authorization header', async () => {
    // Authenticated /v1/asset is filtered per-user by DFX and may omit the
    // asset a buy/sell flow needs — and the Bearer must not leak to a
    // public catalog endpoint.
    fetchMock.mockResolvedValueOnce(jsonOk(ASSETS));

    const assets = await dfxAssetService.list();

    expect(assets).toEqual(ASSETS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/v1/asset`);
    expect(init?.method).toBe('GET');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init).not.toHaveProperty('body');
  });

  it('caches the catalog for the session and refetches after reset()', async () => {
    fetchMock.mockResolvedValue(jsonOk(ASSETS));

    await dfxAssetService.list();
    await dfxAssetService.list();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    dfxAssetService.reset();
    await dfxAssetService.list();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches a FAILED fetch until reset() — a transient error poisons the session', async () => {
    // NOTE: design weakness — the promise (not the value) is cached, so one
    // network hiccup keeps rejecting every later list()/find() until reset().
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(dfxAssetService.list()).rejects.toThrow('Network request failed');

    fetchMock.mockResolvedValueOnce(jsonOk(ASSETS));
    await expect(dfxAssetService.list()).rejects.toThrow('Network request failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    dfxAssetService.reset();
    await expect(dfxAssetService.list()).resolves.toEqual(ASSETS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with DfxApiError on an HTTP 4xx', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({ statusCode: 429, code: 'RATE_LIMIT', message: 'Too many requests' }, 429),
    );

    const err = await dfxAssetService.list().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(429);
  });

  it('passes hostile element shapes through unvalidated', async () => {
    // NOTE: passes through unvalidated — a string id or missing buyable
    // flag flows straight into the buy/sell payload builder.
    const hostile = [{ id: '11', name: 'BTC' }];
    fetchMock.mockResolvedValueOnce(jsonOk(hostile));

    await expect(dfxAssetService.list()).resolves.toEqual(hostile);
  });
});

describe('dfxAssetService.find', () => {
  it('disambiguates the same symbol across chains via the blockchain argument', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(ASSETS));

    await expect(dfxAssetService.find('USDT', 'Ethereum')).resolves.toEqual(ASSETS[2]);
    await expect(dfxAssetService.find('USDT', 'Polygon')).resolves.toEqual(ASSETS[3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('matches symbol and blockchain case-insensitively', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(ASSETS));

    await expect(dfxAssetService.find('btc', 'BITCOIN')).resolves.toEqual(ASSETS[0]);
    await expect(dfxAssetService.find('eth', 'ethereum')).resolves.toEqual(ASSETS[1]);
  });

  it('returns undefined when symbol or chain does not match exactly', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(ASSETS));

    await expect(dfxAssetService.find('WBTC', 'Bitcoin')).resolves.toBeUndefined();
    await expect(dfxAssetService.find('BTC', 'Lightning')).resolves.toBeUndefined();
    // No trimming and no partial matching.
    await expect(dfxAssetService.find(' BTC', 'Bitcoin')).resolves.toBeUndefined();
    await expect(dfxAssetService.find('BT', 'Bitcoin')).resolves.toBeUndefined();
  });

  it('returns undefined on an empty catalog', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk([]));

    await expect(dfxAssetService.find('BTC', 'Bitcoin')).resolves.toBeUndefined();
  });

  it('silently picks the FIRST row when the catalog has duplicates', async () => {
    // NOTE: first-match-wins — if DFX ever ships duplicate (name, blockchain)
    // rows with different ids, funds would silently route to the first id.
    const dupes = [
      asset({ id: 31, name: 'ZCHF', blockchain: 'Ethereum' }),
      asset({ id: 32, name: 'ZCHF', blockchain: 'Ethereum' }),
    ];
    fetchMock.mockResolvedValueOnce(jsonOk(dupes));

    const found = await dfxAssetService.find('ZCHF', 'Ethereum');
    expect(found?.id).toBe(31);
  });

  it('crashes with a raw TypeError when the body is JSON null', async () => {
    // NOTE: passes through unvalidated — list() caches `null` as the catalog
    // and find() dies with an uncontrolled TypeError instead of a typed error.
    fetchMock.mockResolvedValueOnce(jsonOk(null));

    await expect(dfxAssetService.find('BTC', 'Bitcoin')).rejects.toThrow(TypeError);
  });

  it('crashes with a raw TypeError when a row is missing name/blockchain', async () => {
    // NOTE: passes through unvalidated — one malformed catalog row breaks
    // every subsequent lookup for the whole session (the row stays cached).
    fetchMock.mockResolvedValueOnce(jsonOk([{ id: 99 }]));

    await expect(dfxAssetService.find('BTC', 'Bitcoin')).rejects.toThrow(TypeError);
  });
});
