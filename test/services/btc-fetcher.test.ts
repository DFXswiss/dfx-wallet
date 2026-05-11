import { fetchBtcBalance } from '../../src/services/balances/btc-fetcher';

describe('fetchBtcBalance', () => {
  it('returns the confirmed sat balance as a decimal string', async () => {
    let lastUrl: string | undefined;
    const fetchImpl = jest.fn(async (url: string) => {
      lastUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          chain_stats: { funded_txo_sum: 25_000_000, spent_txo_sum: 4_000_000 },
          mempool_stats: { funded_txo_sum: 999, spent_txo_sum: 0 },
        }),
      } as unknown as Response;
    });

    const result = await fetchBtcBalance('bc1qexample', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ rawBalance: '21000000' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lastUrl).toContain('bc1qexample');
  });

  it('ignores mempool_stats — only confirmed balance counts', async () => {
    const fetchImpl = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          chain_stats: { funded_txo_sum: 1_000, spent_txo_sum: 0 },
          mempool_stats: { funded_txo_sum: 5_000_000_000, spent_txo_sum: 0 },
        }),
      }) as unknown as Response,
    );
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ rawBalance: '1000' });
  });

  it('clamps negative diffs to zero so a quirky response cannot underflow', async () => {
    const fetchImpl = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          chain_stats: { funded_txo_sum: 100, spent_txo_sum: 500 },
        }),
      }) as unknown as Response,
    );
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ rawBalance: '0' });
  });

  it('reports HTTP failures as a typed error', async () => {
    const fetchImpl = jest.fn(async () =>
      ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
    );
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ error: 'HTTP 503' });
  });

  it('reports schema-mismatch responses', async () => {
    const fetchImpl = jest.fn(async () =>
      ({ ok: true, status: 200, json: async () => ({ chain_stats: {} }) }) as unknown as Response,
    );
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ error: 'no chain_stats' });
  });

  it('reports network failures as a typed error', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('socket hang up');
    });
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ error: 'socket hang up' });
  });

  it('reports a missing address as an error without hitting the network', async () => {
    const fetchImpl = jest.fn();
    const r = await fetchBtcBalance('', { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toEqual({ error: 'no address' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('flags an AbortError separately so callers can distinguish cancellation', async () => {
    const fetchImpl = jest.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ error: 'aborted' });
  });
});
