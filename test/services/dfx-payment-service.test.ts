/**
 * Wire-contract tests for DfxPaymentService — the most funds-critical client
 * in the app. Every payload field that DFX' SEPA matcher / route builder
 * branches on (paymentMethod, exactPrice, id-only asset refs, iban) is
 * pinned here, plus the symbol→id resolution that decides WHICH asset and
 * currency the money moves through.
 */
import { dfxApi, DfxApiError } from '../../src/features/dfx-backend/services/api';
import { dfxAssetService } from '../../src/features/dfx-backend/services/asset-service';
import { dfxFiatService } from '../../src/features/dfx-backend/services/fiat-service';
import { dfxPaymentService } from '../../src/features/dfx-backend/services/payment-service';
import { env } from '../../src/config/env';
import { jsonOk, createDfxFetchMock } from '../helpers/dfx-http';

const BASE = env.dfxApiUrl;

const { fetchMock, realFetch, findCall } = createDfxFetchMock();

const FIATS = [
  { id: 2, name: 'EUR', buyable: true, sellable: true },
  { id: 3, name: 'CHF', buyable: true, sellable: true },
];

const ASSETS = [
  {
    id: 11,
    name: 'BTC',
    uniqueName: 'Bitcoin/BTC',
    blockchain: 'Bitcoin',
    category: 'PublicAsset',
    type: 'Coin',
    buyable: true,
    sellable: true,
  },
  {
    id: 12,
    name: 'ETH',
    uniqueName: 'Ethereum/ETH',
    blockchain: 'Ethereum',
    category: 'PublicAsset',
    type: 'Coin',
    buyable: true,
    sellable: true,
    evmChainId: 1,
  },
];

/** Serve the public catalogs and delegate everything else to `main`. */
function routeFetch(main: (url: string, init?: RequestInit) => Response) {
  fetchMock.mockImplementation(async (url, init) => {
    if (url === `${BASE}/v1/fiat`) return jsonOk(FIATS);
    if (url === `${BASE}/v1/asset`) return jsonOk(ASSETS);
    return main(url, init);
  });
}

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer TEST_TOKEN',
};

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  dfxAssetService.reset();
  dfxFiatService.reset();
  dfxApi.setAuthToken('TEST_TOKEN');
  dfxApi.setOnUnauthorized(async () => null);
});

afterEach(() => {
  dfxApi.clearAuthToken();
  dfxAssetService.reset();
  dfxFiatService.reset();
});

describe('dfxPaymentService buy flow', () => {
  it('getBuyQuote PUTs /v1/buy/quote with resolved ids, pinned paymentMethod and exactPrice', async () => {
    const quote = { id: 1, amount: 100, estimatedAmount: 0.001, isValid: true };
    routeFetch(() => jsonOk(quote));

    const result = await dfxPaymentService.getBuyQuote({
      amount: 100,
      currency: 'EUR',
      asset: 'BTC',
      blockchain: 'Bitcoin',
    });

    expect(result).toEqual(quote);
    const init = findCall(`${BASE}/v1/buy/quote`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual(AUTH_HEADERS);
    // Exact body contract: id-only refs (id + blockchain together trigger
    // DFX' "Asset blockchain mismatch"), explicit Bank + exactPrice:false.
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 100,
      currency: { id: 2 },
      asset: { id: 11 },
      paymentMethod: 'Bank',
      exactPrice: false,
    });
  });

  it('resolves the catalogs over UNauthenticated requests while the quote carries the Bearer', async () => {
    routeFetch(() => jsonOk({ isValid: true }));

    await dfxPaymentService.getBuyQuote({
      amount: 50,
      currency: 'chf',
      asset: 'eth',
      blockchain: 'ethereum',
    });

    // Symbol matching is case-insensitive (screen passes display strings).
    expect(JSON.parse(findCall(`${BASE}/v1/buy/quote`).body as string)).toMatchObject({
      currency: { id: 3 },
      asset: { id: 12 },
    });
    expect(findCall(`${BASE}/v1/fiat`).headers).toEqual({ 'Content-Type': 'application/json' });
    expect(findCall(`${BASE}/v1/asset`).headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('reuses the cached catalogs across consecutive quotes', async () => {
    routeFetch(() => jsonOk({ isValid: true }));

    await dfxPaymentService.getBuyQuote({
      amount: 1,
      currency: 'EUR',
      asset: 'BTC',
      blockchain: 'Bitcoin',
    });
    await dfxPaymentService.getBuyQuote({
      amount: 2,
      currency: 'EUR',
      asset: 'BTC',
      blockchain: 'Bitcoin',
    });

    const catalogCalls = fetchMock.mock.calls.filter(
      ([u]) => u === `${BASE}/v1/fiat` || u === `${BASE}/v1/asset`,
    );
    expect(catalogCalls).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws and sends NO quote request when the asset is unknown', async () => {
    routeFetch(() => jsonOk({ isValid: true }));

    await expect(
      dfxPaymentService.getBuyQuote({
        amount: 1,
        currency: 'EUR',
        asset: 'DOGE',
        blockchain: 'Bitcoin',
      }),
    ).rejects.toThrow('Asset DOGE on Bitcoin not found');

    expect(fetchMock.mock.calls.some(([u]) => u === `${BASE}/v1/buy/quote`)).toBe(false);
  });

  it('throws and sends NO quote request when the currency is unknown', async () => {
    routeFetch(() => jsonOk({ isValid: true }));

    await expect(
      dfxPaymentService.getBuyQuote({
        amount: 1,
        currency: 'JPY',
        asset: 'BTC',
        blockchain: 'Bitcoin',
      }),
    ).rejects.toThrow('Currency JPY not supported');

    expect(fetchMock.mock.calls.some(([u]) => u === `${BASE}/v1/buy/quote`)).toBe(false);
  });

  it('createBuyPaymentInfo PUTs /v1/buy/paymentInfos with the identical pinned body', async () => {
    const info = { id: 9, iban: 'CH9300762011623852957', remittanceInfo: 'OZ1', isValid: true };
    routeFetch(() => jsonOk(info));

    const result = await dfxPaymentService.createBuyPaymentInfo({
      amount: 250.5,
      currency: 'EUR',
      asset: 'BTC',
      blockchain: 'Bitcoin',
    });

    expect(result).toEqual(info);
    const init = findCall(`${BASE}/v1/buy/paymentInfos`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual(AUTH_HEADERS);
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 250.5,
      currency: { id: 2 },
      asset: { id: 11 },
      paymentMethod: 'Bank',
      exactPrice: false,
    });
  });

  it('confirmBuy PUTs the id-scoped confirm endpoint with an empty-object body', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(undefined));

    await expect(dfxPaymentService.confirmBuy(42)).resolves.toBeUndefined();

    const init = findCall(`${BASE}/v1/buy/paymentInfos/42/confirm`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual(AUTH_HEADERS);
    expect(init.body).toBe('{}');
  });

  it('forwards the AbortSignal to the quote request', async () => {
    routeFetch(() => jsonOk({ isValid: true }));
    const controller = new AbortController();

    await dfxPaymentService.getBuyQuote(
      { amount: 1, currency: 'EUR', asset: 'BTC', blockchain: 'Bitcoin' },
      { signal: controller.signal },
    );

    expect(findCall(`${BASE}/v1/buy/quote`).signal).toBe(controller.signal);
  });
});

describe('dfxPaymentService sell flow', () => {
  it('getSellQuote PUTs /v1/sell/quote WITHOUT paymentMethod and WITHOUT iban', async () => {
    const quote = { id: 2, amount: 0.5, estimatedAmount: 48000, isValid: true };
    routeFetch(() => jsonOk(quote));

    const result = await dfxPaymentService.getSellQuote({
      amount: 0.5,
      asset: 'BTC',
      blockchain: 'Bitcoin',
      currency: 'EUR',
    });

    expect(result).toEqual(quote);
    const init = findCall(`${BASE}/v1/sell/quote`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual(AUTH_HEADERS);
    // toEqual is exact: no paymentMethod / iban keys may sneak in.
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 0.5,
      currency: { id: 2 },
      asset: { id: 11 },
      exactPrice: false,
    });
  });

  it('createSellPaymentInfo PUTs /v1/sell/paymentInfos with the iban verbatim', async () => {
    const info = { id: 3, depositAddress: 'bc1qdeposit', isValid: true };
    routeFetch(() => jsonOk(info));

    const result = await dfxPaymentService.createSellPaymentInfo({
      amount: 0.25,
      asset: 'BTC',
      blockchain: 'Bitcoin',
      currency: 'CHF',
      iban: 'CH9300762011623852957',
    });

    expect(result).toEqual(info);
    const init = findCall(`${BASE}/v1/sell/paymentInfos`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 0.25,
      currency: { id: 3 },
      asset: { id: 11 },
      iban: 'CH9300762011623852957',
      exactPrice: false,
    });
  });

  it('passes an empty or unformatted iban straight through', async () => {
    // NOTE: passes through unvalidated — no client-side IBAN checksum/format
    // validation. The off-ramp destination is whatever string the caller
    // provides; the backend is the only line of defense.
    routeFetch(() => jsonOk({ isValid: true }));

    await dfxPaymentService.createSellPaymentInfo({
      amount: 1,
      asset: 'BTC',
      blockchain: 'Bitcoin',
      currency: 'EUR',
      iban: '',
    });

    expect(JSON.parse(findCall(`${BASE}/v1/sell/paymentInfos`).body as string).iban).toBe('');
  });

  it('confirmSell PUTs the id-scoped confirm endpoint with an empty-object body', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk(undefined));

    await expect(dfxPaymentService.confirmSell(7)).resolves.toBeUndefined();

    const init = findCall(`${BASE}/v1/sell/paymentInfos/7/confirm`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{}');
  });
});

describe('dfxPaymentService bank accounts', () => {
  it('getBankAccounts GETs /v1/bankAccount authenticated', async () => {
    const accounts = [{ id: 1, iban: 'CH9300762011623852957', active: true, default: true }];
    fetchMock.mockResolvedValueOnce(jsonOk(accounts));

    await expect(dfxPaymentService.getBankAccounts()).resolves.toEqual(accounts);

    const init = findCall(`${BASE}/v1/bankAccount`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual(AUTH_HEADERS);
    expect(init).not.toHaveProperty('body');
  });

  it('createBankAccount POSTs iban + label', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ id: 2, iban: 'CH9300762011623852957' }));

    await dfxPaymentService.createBankAccount('CH9300762011623852957', 'Main');

    const init = findCall(`${BASE}/v1/bankAccount`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ iban: 'CH9300762011623852957', label: 'Main' }));
  });

  it('omits the label key entirely when none is given', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ id: 2 }));

    await dfxPaymentService.createBankAccount('CH9300762011623852957');

    // JSON.stringify drops `label: undefined` — pinned so the backend's
    // class-validator never sees an explicit null/undefined label.
    expect(findCall(`${BASE}/v1/bankAccount`).body).toBe(
      JSON.stringify({ iban: 'CH9300762011623852957' }),
    );
  });
});

describe('dfxPaymentService amount serialization edges', () => {
  it('round-trips float64 amounts bit-exactly into the JSON body', async () => {
    routeFetch(() => jsonOk({ isValid: true }));

    await dfxPaymentService.getBuyQuote({
      amount: 0.30000000000000004,
      currency: 'EUR',
      asset: 'BTC',
      blockchain: 'Bitcoin',
    });

    const body = findCall(`${BASE}/v1/buy/quote`).body as string;
    expect(body).toContain('"amount":0.30000000000000004');
    expect(JSON.parse(body).amount).toBe(0.30000000000000004);
  });

  it('serializes sub-1e-6 amounts in scientific notation', async () => {
    // NOTE: contract edge — JSON.stringify(1e-7) emits "1e-7", not a plain
    // decimal. Pinned so a backend parser that chokes on exponent notation
    // is traceable to this client behavior. No client-side min-amount or
    // negative/zero guard exists either.
    routeFetch(() => jsonOk({ isValid: true }));

    await dfxPaymentService.getSellQuote({
      amount: 1e-7,
      asset: 'BTC',
      blockchain: 'Bitcoin',
      currency: 'EUR',
    });

    expect(findCall(`${BASE}/v1/sell/quote`).body as string).toContain('"amount":1e-7');
  });
});

describe('dfxPaymentService error and hostile-response paths', () => {
  it('propagates a structured 400 from the quote endpoint as DfxApiError', async () => {
    routeFetch(() =>
      jsonOk({ statusCode: 400, code: 'AMOUNT_TOO_LOW', message: 'Amount is too low' }, 400),
    );

    const err = await dfxPaymentService
      .getBuyQuote({ amount: 0.01, currency: 'EUR', asset: 'BTC', blockchain: 'Bitcoin' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).statusCode).toBe(400);
    expect((err as DfxApiError).code).toBe('AMOUNT_TOO_LOW');
  });

  it('exposes isKycRequired on a 403 KYC gate from paymentInfos', async () => {
    routeFetch(() =>
      jsonOk({ statusCode: 403, code: 'KYC_LEVEL_REQUIRED', message: 'KYC required' }, 403),
    );

    const err = await dfxPaymentService
      .createBuyPaymentInfo({ amount: 5000, currency: 'EUR', asset: 'BTC', blockchain: 'Bitcoin' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DfxApiError);
    expect((err as DfxApiError).isKycRequired).toBe(true);
  });

  it('propagates a network rejection of the quote request', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === `${BASE}/v1/fiat`) return jsonOk(FIATS);
      if (url === `${BASE}/v1/asset`) return jsonOk(ASSETS);
      throw new TypeError('Network request failed');
    });

    await expect(
      dfxPaymentService.getSellQuote({
        amount: 1,
        asset: 'BTC',
        blockchain: 'Bitcoin',
        currency: 'EUR',
      }),
    ).rejects.toThrow('Network request failed');
  });

  it('returns an empty-object quote response as-is', async () => {
    // NOTE: passes through unvalidated — `{}` is returned as a
    // BuyPaymentInfoDto. amount/estimatedAmount/iban/remittanceInfo are all
    // undefined; nothing in the service guarantees the payment instructions
    // shown to the user are present. The caller owns ALL validation.
    routeFetch(() => jsonOk({}));

    await expect(
      dfxPaymentService.getBuyQuote({
        amount: 1,
        currency: 'EUR',
        asset: 'BTC',
        blockchain: 'Bitcoin',
      }),
    ).resolves.toEqual({});
  });

  it('resolves (does not throw) when the backend flags the quote invalid', async () => {
    // NOTE: contract — isValid:false + error code come back via the resolved
    // value, not as a rejection. UI code that forgets to check isValid would
    // happily render iban/amount from an invalid quote.
    const invalid = { isValid: false, error: 'AmountTooHigh', amount: 9e9 };
    routeFetch(() => jsonOk(invalid));

    await expect(
      dfxPaymentService.getBuyQuote({
        amount: 9e9,
        currency: 'EUR',
        asset: 'BTC',
        blockchain: 'Bitcoin',
      }),
    ).resolves.toEqual(invalid);
  });
});
