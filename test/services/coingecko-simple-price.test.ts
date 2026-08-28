import { fetchSimplePrices } from '../../src/services/pricing/coingecko-simple-price';
import { FiatCurrency } from '../../src/services/pricing-service';

describe('fetchSimplePrices', () => {
  it('returns the upstream price map keyed by coin id', async () => {
    const fetchImpl = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            bitcoin: { usd: 80000, chf: 70000 },
            ethereum: { usd: 3000, chf: 2700 },
          }),
        }) as unknown as Response,
    );
    const result = await fetchSimplePrices(
      ['bitcoin', 'ethereum'],
      [FiatCurrency.USD, FiatCurrency.CHF],
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.get('bitcoin')).toEqual({ [FiatCurrency.USD]: 80000, [FiatCurrency.CHF]: 70000 });
    expect(result.get('ethereum')?.[FiatCurrency.USD]).toBe(3000);
  });

  it('drops non-numeric entries silently', async () => {
    const fetchImpl = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            bitcoin: { usd: 'not-a-number', chf: 70000 },
          }),
        }) as unknown as Response,
    );
    const result = await fetchSimplePrices(['bitcoin'], [FiatCurrency.USD, FiatCurrency.CHF], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.get('bitcoin')).toEqual({ [FiatCurrency.CHF]: 70000 });
  });

  it('chunks long id lists into multiple network calls', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `coin-${i}`);
    const fetchImpl = jest.fn(
      async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response,
    );
    await fetchSimplePrices(ids, [FiatCurrency.USD], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    // 100-id batches → 3 calls for 250 ids.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('skips failed batches without breaking subsequent ones', async () => {
    let calls = 0;
    const fetchImpl = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 429, json: async () => ({}) } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ethereum: { usd: 3000 } }),
      } as unknown as Response;
    });
    const ids = [...Array.from({ length: 100 }, (_, i) => `coin-${i}`), 'ethereum'];
    const result = await fetchSimplePrices(ids, [FiatCurrency.USD], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.get('ethereum')?.[FiatCurrency.USD]).toBe(3000);
  });

  it('short-circuits on empty inputs', async () => {
    const fetchImpl = jest.fn(async () => ({}) as unknown as Response);
    const a = await fetchSimplePrices([], [FiatCurrency.USD], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const b = await fetchSimplePrices(['bitcoin'], [], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(a.size).toBe(0);
    expect(b.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('tolerates network exceptions per batch', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('socket hang up');
    });
    const result = await fetchSimplePrices(['bitcoin'], [FiatCurrency.USD], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.size).toBe(0);
  });

  it('falls back to global fetch when no options.fetchImpl is provided', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ bitcoin: { usd: 50000 } }),
          }) as unknown as Response,
      ) as unknown as typeof fetch;
      const result = await fetchSimplePrices(['bitcoin'], [FiatCurrency.USD]);
      expect(result.get('bitcoin')?.[FiatCurrency.USD]).toBe(50000);
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('forwards the AbortSignal through to fetch when one is provided', async () => {
    const seen: { signal?: AbortSignal | undefined } = {};
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      seen.signal = init?.signal ?? undefined;
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
    });
    const controller = new AbortController();
    await fetchSimplePrices(['bitcoin'], [FiatCurrency.USD], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signal: controller.signal,
    });
    expect(seen.signal).toBe(controller.signal);
  });

  it('skips coin-id entries whose payload value is null', async () => {
    const fetchImpl = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            bitcoin: { usd: 80000 },
            'dead-coin': null,
          }),
        }) as unknown as Response,
    );
    const result = await fetchSimplePrices(
      ['bitcoin', 'dead-coin'],
      [FiatCurrency.USD],
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.get('bitcoin')?.[FiatCurrency.USD]).toBe(80000);
    expect(result.has('dead-coin')).toBe(false);
  });

  it('skips a batch whose response.json() rejects (malformed JSON)', async () => {
    const fetchImpl = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('unexpected token');
          },
        }) as unknown as Response,
    );
    const result = await fetchSimplePrices(['bitcoin'], [FiatCurrency.USD], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.size).toBe(0);
  });
});
