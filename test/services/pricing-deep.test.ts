/**
 * Threat-model-driven coverage for the pricing layer beyond
 * `pricing-service.test.ts`. The threat model for pricing is: "never serve
 * stale/swapped values, fail loud". The tests below pin the CURRENT
 * behaviour of `pricingService` against that goal and call out — with
 * `// NOTE:` — the places where the implementation does NOT fully meet it
 * (most importantly: a failed `refresh()` throws, but the *previous*
 * cache stays readable through `getPriceById`/`getExchangeRate`, so a
 * caller that ignores the throw will silently serve stale prices).
 *
 * Also exercises currency/coin isolation (no cross-currency or cross-coin
 * value swapping) and the boundary handling of non-finite / NaN / negative
 * upstream prices.
 */

import { FiatCurrency, pricingService } from '../../src/services/pricing-service';

type Internals = {
  cache: unknown;
  isInitialized: boolean;
  inflight: Promise<void> | null;
};

const reset = () => {
  const internals = pricingService as unknown as Internals;
  internals.cache = undefined;
  internals.isInitialized = false;
  internals.inflight = null;
};

const okFetch = (payload: Record<string, Record<string, number> | null>): jest.Mock => {
  const fn = jest.fn(
    async () => ({ ok: true, status: 200, json: async () => payload }) as unknown as Response,
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
};

const failFetch = (status: number): jest.Mock => {
  const fn = jest.fn(
    async () => ({ ok: false, status, json: async () => ({}) }) as unknown as Response,
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
};

describe('pricing-deep', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => reset());
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
  afterAll(() => reset());

  describe('stale-price behaviour on refresh failure (fail-loud audit)', () => {
    it('throws on a failed refresh but KEEPS the previous cache readable (documented stale window)', async () => {
      okFetch({ bitcoin: { usd: 100 } });
      await pricingService.initialize();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(100);

      // Upstream now fails. refresh() rejects (fail-loud to its caller)…
      failFetch(503);
      await expect(pricingService.refresh()).rejects.toThrow(/CoinGecko HTTP 503/);

      // …but the OLD price is still served to anyone reading the cache.
      // NOTE: getPriceById has no staleness/freshness signal of its own, so a
      // caller that swallows the refresh rejection (e.g. the auto-refresh
      // timer, which `.catch(() => undefined)`s) will keep showing the last
      // good price indefinitely. This is "stale but not zero" by design
      // (see refresh() comment), but it is the gap the threat model flags:
      // the read API cannot tell the UI the value is stale.
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(100);
      expect(pricingService.isReady()).toBe(true);
    });

    it('a successful refresh after a failure replaces the stale value', async () => {
      okFetch({ bitcoin: { usd: 100 } });
      await pricingService.initialize();

      failFetch(500);
      await expect(pricingService.refresh()).rejects.toThrow();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(100);

      okFetch({ bitcoin: { usd: 250 } });
      await pricingService.refresh();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(250);
    });

    it('initialize failure leaves the service un-ready and serving nothing (fails loud + empty)', async () => {
      failFetch(429);
      await expect(pricingService.initialize()).rejects.toThrow(/CoinGecko HTTP 429/);
      expect(pricingService.isReady()).toBe(false);
      // No cache → no price. Better than a stale/guessed value.
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBeUndefined();
    });
  });

  describe('error propagation shape', () => {
    it('propagates the HTTP status in the thrown message (no silent swallow on init)', async () => {
      failFetch(418);
      await expect(pricingService.initialize()).rejects.toThrow('CoinGecko HTTP 418');
    });

    it('a rejected json() body bubbles up as a thrown error, not a zero price', async () => {
      globalThis.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => {
              throw new Error('malformed json');
            },
          }) as unknown as Response,
      ) as unknown as typeof fetch;
      await expect(pricingService.initialize()).rejects.toThrow('malformed json');
      expect(pricingService.isReady()).toBe(false);
    });
  });

  describe('currency / coin isolation — no swapped values', () => {
    it('keeps per-currency prices for one coin strictly separate', async () => {
      okFetch({ bitcoin: { usd: 80000, chf: 70000, eur: 75000 } });
      await pricingService.initialize();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(80000);
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.CHF)).toBe(70000);
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.EUR)).toBe(75000);
    });

    it('does not leak one coin price into another coin id', async () => {
      okFetch({ bitcoin: { usd: 80000 }, ethereum: { usd: 3000 } });
      await pricingService.initialize();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(80000);
      expect(pricingService.getPriceById('ethereum', FiatCurrency.USD)).toBe(3000);
      // A coin that was not in the payload must be undefined, never another
      // coin's number.
      expect(pricingService.getPriceById('tether', FiatCurrency.USD)).toBeUndefined();
    });

    it('returns undefined for a currency the upstream omitted (no fallback to another currency)', async () => {
      okFetch({ bitcoin: { usd: 80000 } });
      await pricingService.initialize();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.CHF)).toBeUndefined();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.EUR)).toBeUndefined();
    });

    it('USDT USD anchor does not bleed into other coins or currencies', async () => {
      okFetch({
        tether: { usd: 0.997, chf: 0.9, eur: 0.92 },
        bitcoin: { usd: 80000 },
      });
      await pricingService.initialize();
      // tether USD pinned to 1…
      expect(pricingService.getPriceById('tether', FiatCurrency.USD)).toBe(1);
      // …but CHF/EUR untouched and bitcoin untouched.
      expect(pricingService.getPriceById('tether', FiatCurrency.CHF)).toBe(0.9);
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(80000);
    });
  });

  describe('non-finite / out-of-range upstream prices are dropped (not served)', () => {
    it('drops NaN, Infinity and -Infinity quotes silently', async () => {
      okFetch({
        bitcoin: {
          usd: Number.NaN,
          chf: Number.POSITIVE_INFINITY,
          eur: Number.NEGATIVE_INFINITY,
        },
      });
      await pricingService.initialize();
      // None of the non-finite values survive the `Number.isFinite` filter.
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBeUndefined();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.CHF)).toBeUndefined();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.EUR)).toBeUndefined();
    });

    it('NOTE: a negative finite price is accepted as-is (no sanity floor)', async () => {
      // The filter only checks `typeof === number && Number.isFinite`, so a
      // bogus negative quote from a compromised upstream WOULD be stored and
      // served. Pinning the current behaviour; a hardening pass might add a
      // `price > 0` guard.
      okFetch({ bitcoin: { usd: -5 } });
      await pricingService.initialize();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBe(-5);
    });

    it('drops a string-typed price (wrong wire type)', async () => {
      okFetch({ bitcoin: { usd: '80000' as unknown as number } });
      await pricingService.initialize();
      expect(pricingService.getPriceById('bitcoin', FiatCurrency.USD)).toBeUndefined();
    });
  });

  describe('getFiatValue conversion correctness', () => {
    it('multiplies the value by the cached rate with decimal precision', async () => {
      okFetch({ bitcoin: { usd: 0.1 } });
      await pricingService.initialize();
      // 0.1 * 3 via Decimal.js must equal exactly 0.3, not 0.30000000000000004.
      const v = await pricingService.getFiatValue(3, 'btc', FiatCurrency.USD);
      expect(v).toBe(0.3);
    });

    it('returns 0 (not a throw) when the rate is missing — caller renders an empty cell', async () => {
      okFetch({});
      const v = await pricingService.getFiatValue(5, 'btc', FiatCurrency.USD);
      expect(v).toBe(0);
    });

    it('lazily initialises on first getFiatValue call', async () => {
      const fetchMock = okFetch({ bitcoin: { usd: 100 } });
      // No explicit initialize() — getFiatValue must trigger it.
      const v = await pricingService.getFiatValue(2, 'btc', FiatCurrency.USD);
      expect(v).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('propagates the initialize failure when getFiatValue triggers a cold boot that fails', async () => {
      failFetch(500);
      // getFiatValue awaits initialize(), which rejects — the rejection must
      // surface, not resolve to a silent 0.
      await expect(pricingService.getFiatValue(2, 'btc', FiatCurrency.USD)).rejects.toThrow(
        /CoinGecko HTTP 500/,
      );
    });
  });

  describe('getExchangeRate ticker mapping', () => {
    it('maps the curated tickers onto their CoinGecko ids', async () => {
      okFetch({
        ethereum: { usd: 3000 },
        'polygon-ecosystem-token': { usd: 0.5 },
        'tether-gold': { usd: 2400 },
        frankencoin: { usd: 1.08 },
      });
      await pricingService.initialize();
      expect(pricingService.getExchangeRate('eth', FiatCurrency.USD)).toBe(3000);
      // post-rebrand POL id
      expect(pricingService.getExchangeRate('matic', FiatCurrency.USD)).toBe(0.5);
      expect(pricingService.getExchangeRate('xaut', FiatCurrency.USD)).toBe(2400);
      expect(pricingService.getExchangeRate('zchf', FiatCurrency.USD)).toBe(1.08);
    });

    it('returns undefined for a ticker whose id was not in the payload', async () => {
      okFetch({ bitcoin: { usd: 80000 } });
      await pricingService.initialize();
      expect(pricingService.getExchangeRate('deuro', FiatCurrency.USD)).toBeUndefined();
    });
  });

  describe('single round-trip warms both pricing surfaces', () => {
    it('one initialize() request feeds both getExchangeRate and getPriceById', async () => {
      const fetchMock = okFetch({ bitcoin: { usd: 80000 }, ethereum: { usd: 3000 } });
      await pricingService.initialize();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // ticker surface
      expect(pricingService.getExchangeRate('btc', FiatCurrency.USD)).toBe(80000);
      // raw-id surface
      expect(pricingService.getPriceById('ethereum', FiatCurrency.USD)).toBe(3000);
    });

    it('requests USD, CHF and EUR in a single call', async () => {
      const fetchMock = okFetch({ bitcoin: { usd: 1 } });
      await pricingService.initialize();
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain('vs_currencies=usd,chf,eur');
    });
  });
});
