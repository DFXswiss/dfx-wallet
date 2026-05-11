import { FiatCurrency, pricingService } from '../../src/services/pricing-service';

describe('pricingService', () => {
  const originalFetch = globalThis.fetch;

  // The pricing service is a module-level singleton. Reach into it to wipe
  // the internal cache between cases so each test runs against a known
  // empty state and forces a fresh upstream call.
  const resetPricingService = () => {
    const internals = pricingService as unknown as {
      cache: unknown;
      isInitialized: boolean;
      inflight: Promise<void> | null;
    };
    internals.cache = undefined;
    internals.isInitialized = false;
    internals.inflight = null;
  };

  beforeEach(() => {
    resetPricingService();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    resetPricingService();
  });

  const stubFetch = (payload: Record<string, Record<string, number>>): jest.Mock => {
    const fn = jest.fn(
      async () => ({ ok: true, status: 200, json: async () => payload }) as unknown as Response,
    );
    globalThis.fetch = fn as unknown as typeof fetch;
    return fn;
  };

  it('initialise populates the cache from a single CoinGecko round-trip', async () => {
    const fetchMock = stubFetch({
      bitcoin: { usd: 80000, chf: 70000, eur: 75000 },
      ethereum: { usd: 3000, chf: 2700, eur: 2800 },
      tether: { usd: 0.999, chf: 0.79, eur: 0.86 },
    });
    await pricingService.initialize();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pricingService.isReady()).toBe(true);

    expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(80000);
    expect(pricingService.getPriceById('bitcoin', FiatCurrency.CHF)).toBe(70000);
    expect(pricingService.getPriceById('ethereum', FiatCurrency.EUR)).toBe(2800);
    // USDT is anchored to exactly 1 USD even when CoinGecko returns 0.999.
    expect(pricingService.getPriceById('tether', FiatCurrency.USD)).toBe(1);
  });

  it('preserves CoinGecko USDT-CHF and USDT-EUR (only USD is anchored)', async () => {
    stubFetch({ tether: { usd: 0.999, chf: 0.79, eur: 0.86 } });
    await pricingService.initialize();
    expect(pricingService.getPriceById('tether', FiatCurrency.CHF)).toBe(0.79);
    expect(pricingService.getPriceById('tether', FiatCurrency.EUR)).toBe(0.86);
  });

  it('returns undefined for unknown coingecko ids without throwing', async () => {
    stubFetch({ bitcoin: { usd: 80000 } });
    await pricingService.initialize();
    expect(pricingService.getPriceById('not-a-coin', FiatCurrency.USD)).toBeUndefined();
  });

  it('legacy getExchangeRate forwards through the ticker→id map', async () => {
    stubFetch({
      bitcoin: { usd: 80000, chf: 70000 },
      tether: { usd: 0.999, chf: 0.79 },
    });
    await pricingService.initialize();
    expect(pricingService.getExchangeRate('btc', FiatCurrency.USD)).toBe(80000);
    expect(pricingService.getExchangeRate('btc', FiatCurrency.CHF)).toBe(70000);
    // USD-USDT anchored, CHF-USDT not.
    expect(pricingService.getExchangeRate('usdt', FiatCurrency.USD)).toBe(1);
    expect(pricingService.getExchangeRate('usdt', FiatCurrency.CHF)).toBe(0.79);
  });

  it('initialize coalesces concurrent callers behind one fetch', async () => {
    const fetchMock = stubFetch({ bitcoin: { usd: 100 } });
    await Promise.all([
      pricingService.initialize(),
      pricingService.initialize(),
      pricingService.initialize(),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('subsequent initialize after success is a no-op', async () => {
    const fetchMock = stubFetch({ bitcoin: { usd: 100 } });
    await pricingService.initialize();
    await pricingService.initialize();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refresh re-fetches and replaces the cache', async () => {
    const first = stubFetch({ bitcoin: { usd: 100 } });
    await pricingService.initialize();
    expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(100);

    const second = stubFetch({ bitcoin: { usd: 120 } });
    await pricingService.refresh();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(120);
  });

  it('initialize throws on upstream failure and stays uninitialised', async () => {
    const fetchMock = jest.fn(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response,
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(pricingService.initialize()).rejects.toThrow(/CoinGecko HTTP 500/);
    expect(pricingService.isReady()).toBe(false);
  });

  it('getFiatValue converts via the cached rate', async () => {
    stubFetch({ bitcoin: { usd: 50000 } });
    const value = await pricingService.getFiatValue(2, 'btc', FiatCurrency.USD);
    expect(value).toBeCloseTo(100000);
  });

  it('getFiatValue returns 0 for an unknown rate', async () => {
    stubFetch({});
    const value = await pricingService.getFiatValue(2, 'btc', FiatCurrency.USD);
    expect(value).toBe(0);
  });
});
