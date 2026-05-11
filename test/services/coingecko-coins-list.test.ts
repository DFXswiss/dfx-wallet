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
  return jest.fn(async () =>
    ({ ok: true, status: 200, json: async () => payload }) as unknown as Response,
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
    const id = await lookupCoinId(
      'ethereum',
      '0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3',
      { fetchImpl },
    );
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
    const id = await lookupCoinId(
      'ethereum',
      '0x0000000000000000000000000000000000000000',
      { fetchImpl },
    );
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
    const fetchImpl = jest.fn(async () =>
      ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
    );
    await expect(
      lookupCoinId('ethereum', '0xabc', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP 503/);
  });
});
