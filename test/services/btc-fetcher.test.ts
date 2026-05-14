import { fetchBtcBalance, fetchBtcTransactions } from '../../src/services/balances/btc-fetcher';

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
    const fetchImpl = jest.fn(
      async () =>
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
    const fetchImpl = jest.fn(
      async () =>
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
    const fetchImpl = jest.fn(
      async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
    );
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ error: 'HTTP 503' });
  });

  it('reports schema-mismatch responses', async () => {
    const fetchImpl = jest.fn(
      async () =>
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

  it('forwards an AbortSignal when provided', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ chain_stats: { funded_txo_sum: 100, spent_txo_sum: 0 } }),
    } as unknown as Response));
    const controller = new AbortController();
    await fetchBtcBalance('addr', { fetchImpl, signal: controller.signal });
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('falls back to a generic message when the thrown error is not an Error instance', async () => {
    const fetchImpl = jest.fn(async () => {
      throw 'boom';
    });
    const r = await fetchBtcBalance('addr', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ error: 'fetch failed' });
  });

  it('treats spent_txo_sum: undefined as 0', async () => {
    const fetchImpl = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            chain_stats: { funded_txo_sum: 5_000 },
          }),
        }) as unknown as Response,
    );
    const r = await fetchBtcBalance('addr', { fetchImpl });
    expect(r).toEqual({ rawBalance: '5000' });
  });
});

describe('fetchBtcTransactions', () => {
  it('returns the JSON array of transactions for a healthy response', async () => {
    const txs = [
      {
        txid: 'a',
        status: { confirmed: true, block_time: 1 },
        vin: [],
        vout: [],
      },
    ];
    const fetchImpl = jest.fn(
      async () => ({ ok: true, status: 200, json: async () => txs } as unknown as Response),
    );
    const r = await fetchBtcTransactions('addr', { fetchImpl });
    expect(r).toEqual({ ok: true, value: txs });
  });

  it('falls back to an empty list when the response is not an array', async () => {
    const fetchImpl = jest.fn(
      async () => ({ ok: true, status: 200, json: async () => ({}) } as unknown as Response),
    );
    const r = await fetchBtcTransactions('addr', { fetchImpl });
    expect(r).toEqual({ ok: true, value: [] });
  });

  it('reports HTTP failures', async () => {
    const fetchImpl = jest.fn(
      async () => ({ ok: false, status: 404, json: async () => ({}) } as unknown as Response),
    );
    const r = await fetchBtcTransactions('addr', { fetchImpl });
    expect(r).toEqual({ ok: false, error: 'HTTP 404' });
  });

  it('reports network failures', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('socket reset');
    });
    const r = await fetchBtcTransactions('addr', { fetchImpl });
    expect(r).toEqual({ ok: false, error: 'socket reset' });
  });

  it('flags an AbortError separately', async () => {
    const fetchImpl = jest.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    const r = await fetchBtcTransactions('addr', { fetchImpl });
    expect(r).toEqual({ ok: false, error: 'aborted' });
  });

  it('falls back to a generic message when thrown value is not an Error instance', async () => {
    const fetchImpl = jest.fn(async () => {
      throw 'boom';
    });
    const r = await fetchBtcTransactions('addr', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, error: 'fetch failed' });
  });

  it('reports a missing address without hitting the network', async () => {
    const fetchImpl = jest.fn();
    const r = await fetchBtcTransactions('', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, error: 'no address' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
