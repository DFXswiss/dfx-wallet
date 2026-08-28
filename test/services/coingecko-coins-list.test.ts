import {
  __resetCoingeckoCoinsList,
  COINGECKO_PLATFORM,
  lookupCoinId,
  lookupCoinIds,
  type CoinGeckoCoin,
} from '../../src/services/pricing/coingecko-coins-list';

const SAMPLE: CoinGeckoCoin[] = [
  {
    id: 'ondo-finance',
    symbol: 'ondo',
    name: 'Ondo Finance',
    platforms: {
      ethereum: '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3',
    },
  },
  {
    id: 'uniswap',
    symbol: 'uni',
    name: 'Uniswap',
    platforms: {
      ethereum: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      'arbitrum-one': '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0',
    },
  },
  {
    id: 'usd-coin',
    symbol: 'usdc',
    name: 'USD Coin',
    platforms: {
      ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      'polygon-pos': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    },
  },
];

const stubFetch = (payload: unknown): jest.Mock => {
  return jest.fn(
    async () => ({ ok: true, status: 200, json: async () => payload }) as unknown as Response,
  );
};

describe('coingecko-coins-list', () => {
  beforeEach(() => {
    __resetCoingeckoCoinsList();
  });

  it('maps every supported ChainId to its CoinGecko platform slug', () => {
    expect(COINGECKO_PLATFORM.ethereum).toBe('ethereum');
    expect(COINGECKO_PLATFORM.arbitrum).toBe('arbitrum-one');
    expect(COINGECKO_PLATFORM.polygon).toBe('polygon-pos');
    expect(COINGECKO_PLATFORM.base).toBe('base');
    expect(COINGECKO_PLATFORM.bitcoin).toBeNull();
  });

  it('resolves a contract on ethereum to its CoinGecko coin id', async () => {
    const fetchImpl = stubFetch(SAMPLE) as unknown as typeof fetch;
    const id = await lookupCoinId('ethereum', '0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3', {
      fetchImpl,
    });
    expect(id).toBe('ondo-finance');
  });

  it('lower-cases the contract for the index lookup', async () => {
    const fetchImpl = stubFetch(SAMPLE) as unknown as typeof fetch;
    const id = await lookupCoinId(
      'ethereum',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'.toUpperCase(),
      { fetchImpl },
    );
    expect(id).toBe('usd-coin');
  });

  it('returns null for a contract that is not on CoinGecko', async () => {
    const fetchImpl = stubFetch(SAMPLE) as unknown as typeof fetch;
    const id = await lookupCoinId('ethereum', '0x0000000000000000000000000000000000000000', {
      fetchImpl,
    });
    expect(id).toBeNull();
  });

  it('returns null for non-EVM chains without hitting the network', async () => {
    const fetchImpl = jest.fn(async () => ({}) as unknown as Response);
    const id = await lookupCoinId('bitcoin', '0xanything', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(id).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reuses the cache across consecutive lookups (single network call)', async () => {
    const fetchImpl = stubFetch(SAMPLE);
    const impl = fetchImpl as unknown as typeof fetch;
    await lookupCoinId('ethereum', '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3', {
      fetchImpl: impl,
    });
    await lookupCoinId('arbitrum', '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0', {
      fetchImpl: impl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lookupCoinIds bulk-resolves a list of contracts', async () => {
    const fetchImpl = stubFetch(SAMPLE) as unknown as typeof fetch;
    const map = await lookupCoinIds(
      'ethereum',
      [
        '0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3',
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        '0x0000000000000000000000000000000000000000',
      ],
      { fetchImpl },
    );
    expect(map.size).toBe(2);
    expect(map.get('0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3')).toBe('ondo-finance');
    expect(map.get('0x1f9840a85d5af5bf1d1762f925bdaddc4201f984')).toBe('uniswap');
  });

  it('lookupCoinIds returns empty for non-EVM chains', async () => {
    const fetchImpl = jest.fn(async () => ({}) as unknown as Response);
    const map = await lookupCoinIds('bitcoin', ['0xabc'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(map.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lookupCoinIds short-circuits on an empty contract list', async () => {
    const fetchImpl = jest.fn(async () => ({}) as unknown as Response);
    const map = await lookupCoinIds('ethereum', [], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(map.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws when the upstream fails so callers can degrade gracefully', async () => {
    const fetchImpl = jest.fn(
      async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
    );
    await expect(
      lookupCoinId('ethereum', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('throws when the upstream returns a non-array payload', async () => {
    __resetCoingeckoCoinsList();
    const fetchImpl = jest.fn(
      async () =>
        ({ ok: true, status: 200, json: async () => ({ oops: true }) }) as unknown as Response,
    );
    await expect(
      lookupCoinId('ethereum', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/not an array/);
  });

  it('returns null for an unsupported chain (no COINGECKO_PLATFORM entry)', async () => {
    __resetCoingeckoCoinsList();
    const fetchImpl = jest.fn();
    const result = await lookupCoinId('bitcoin', '0xabc', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lookupCoinIds returns empty for an unsupported chain', async () => {
    __resetCoingeckoCoinsList();
    const fetchImpl = jest.fn();
    const result = await lookupCoinIds('bitcoin', ['0xabc'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lookupCoinIds returns empty when no contracts match the platform index', async () => {
    __resetCoingeckoCoinsList();
    const fetchImpl = jest.fn(
      async () => ({ ok: true, status: 200, json: async () => SAMPLE }) as unknown as Response,
    );
    const result = await lookupCoinIds('ethereum', ['0x0000000000000000000000000000000000000000'], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.size).toBe(0);
  });

  it('first-seen entry wins when CoinGecko lists multiple coins on the same contract', async () => {
    __resetCoingeckoCoinsList();
    const duplicateSample: CoinGeckoCoin[] = [
      { id: 'first-coin', symbol: 'a', name: 'First', platforms: { ethereum: '0xDEAD' } },
      { id: 'second-coin', symbol: 'b', name: 'Second', platforms: { ethereum: '0xdead' } },
    ];
    const fetchImpl = stubFetch(duplicateSample) as unknown as typeof fetch;
    expect(await lookupCoinId('ethereum', '0xdead', { fetchImpl })).toBe('first-coin');
  });

  it('returns the same inflight promise when called concurrently before the fetch resolves', async () => {
    __resetCoingeckoCoinsList();
    let release: (() => void) | undefined;
    const fetchImpl = jest.fn(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { ok: true, status: 200, json: async () => SAMPLE } as unknown as Response;
    });
    const a = lookupCoinId('ethereum', '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const b = lookupCoinId('ethereum', '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    // Both calls land on the same inflight promise — only one network call.
    release?.();
    await Promise.all([a, b]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to global fetch when options is omitted', async () => {
    __resetCoingeckoCoinsList();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = jest.fn(
        async () => ({ ok: true, status: 200, json: async () => SAMPLE }) as unknown as Response,
      ) as unknown as typeof fetch;
      const id = await lookupCoinId('ethereum', '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3');
      expect(id).toBe('ondo-finance');
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('lookupCoinIds also defaults to global fetch when options is omitted', async () => {
    __resetCoingeckoCoinsList();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = jest.fn(
        async () => ({ ok: true, status: 200, json: async () => SAMPLE }) as unknown as Response,
      ) as unknown as typeof fetch;
      const map = await lookupCoinIds('ethereum', [
        '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3',
      ]);
      expect(map.size).toBe(1);
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('lookupCoinIds returns empty when the platform has no entries in the index', async () => {
    __resetCoingeckoCoinsList();
    // SAMPLE has nothing on `polygon-pos` for the empty list path. Wait —
    // it does (USDC on polygon-pos). Synthesise a payload that *has*
    // `arbitrum-one` entries but not `polygon-pos`, then query polygon.
    const partialSample: CoinGeckoCoin[] = [
      {
        id: 'arb-only',
        symbol: 'arb',
        name: 'Arb Only',
        platforms: { 'arbitrum-one': '0xabc' },
      },
    ];
    const fetchImpl = stubFetch(partialSample) as unknown as typeof fetch;
    const map = await lookupCoinIds('polygon', ['0xabc'], { fetchImpl });
    expect(map.size).toBe(0);
  });

  it('buildIndex skips coins with empty platform contract strings', async () => {
    __resetCoingeckoCoinsList();
    const fetchImpl = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => [
            { id: 'a', symbol: 'a', name: 'A', platforms: { ethereum: '' } },
            { id: 'b', symbol: 'b', name: 'B', platforms: null },
            { id: 'c', symbol: 'c', name: 'C', platforms: { ethereum: '0xCAFE' } },
          ],
        }) as unknown as Response,
    );
    expect(
      await lookupCoinId('ethereum', '0xcafe', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe('c');
  });
});
