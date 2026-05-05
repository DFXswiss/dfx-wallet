import {
  WdkIndexerClient,
  WdkIndexerError,
  createIndexerClient,
} from '../../src/services/wdk-indexer/client';
import { chainIdToIndexerBlockchain } from '../../src/services/wdk-indexer/network-mapping';

const CONFIG = {
  baseUrl: 'https://wdk-api.tether.io',
  apiKey: 'sk_test_key',
};

const mockJsonResponse = (body: unknown, init: { status?: number; ok?: boolean } = {}) => {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    json: jest.fn(async () => body),
  } as unknown as Response;
};

describe('WdkIndexerClient', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('getTokenBalance', () => {
    it('hits the documented path with the API key in the x-api-key header', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          tokenBalance: {
            amount: '1234567',
            token: 'usdt',
            blockchain: 'ethereum',
            address: '0xabc',
          },
        }),
      );
      const client = new WdkIndexerClient(CONFIG);

      const balance = await client.getTokenBalance({
        blockchain: 'ethereum',
        token: 'USDT',
        address: '0xabc',
      });

      expect(balance.amount).toBe('1234567');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://wdk-api.tether.io/api/v1/ethereum/usdt/0xabc/token-balances',
      );
      expect((init as RequestInit).headers).toMatchObject({
        'x-api-key': 'sk_test_key',
      });
    });

    it('lowercases the token slug to match the indexer URL contract', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse({
          tokenBalance: { amount: '0', token: 'btc', blockchain: 'bitcoin', address: 'bc1q' },
        }),
      );
      const client = new WdkIndexerClient(CONFIG);

      await client.getTokenBalance({ blockchain: 'bitcoin', token: 'BTC', address: 'bc1q' });

      expect(fetchMock.mock.calls[0][0]).toContain('/bitcoin/btc/bc1q/token-balances');
    });
  });

  describe('getTokenTransfers', () => {
    it('returns the tokenTransfers array from the response', async () => {
      const transfers = [
        {
          hash: '0x1',
          blockNumber: 100,
          timestamp: 1700000000,
          from: '0xa',
          to: '0xb',
          amount: '1',
          token: 'usdt',
          blockchain: 'ethereum',
          direction: 'out',
        },
      ];
      fetchMock.mockResolvedValueOnce(mockJsonResponse({ tokenTransfers: transfers }));
      const client = new WdkIndexerClient(CONFIG);

      const result = await client.getTokenTransfers({
        blockchain: 'ethereum',
        token: 'usdt',
        address: '0xa',
      });

      expect(result).toEqual(transfers);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://wdk-api.tether.io/api/v1/ethereum/usdt/0xa/token-transfers',
      );
    });
  });

  describe('error handling', () => {
    it('throws WdkIndexerError with the indexer-supplied error/message on non-2xx', async () => {
      fetchMock.mockResolvedValueOnce(
        mockJsonResponse(
          { error: 'unauthorized', message: 'Invalid API key' },
          { status: 401 },
        ),
      );
      const client = new WdkIndexerClient(CONFIG);

      await expect(
        client.getTokenBalance({ blockchain: 'ethereum', token: 'usdt', address: '0xa' }),
      ).rejects.toMatchObject({
        name: 'WdkIndexerError',
        statusCode: 401,
        code: 'unauthorized',
        message: 'Invalid API key',
      });
    });

    it('falls back to a synthetic error when the body is not JSON', async () => {
      const failingResponse = {
        ok: false,
        status: 500,
        json: jest.fn(async () => {
          throw new Error('not json');
        }),
      } as unknown as Response;
      fetchMock.mockResolvedValueOnce(failingResponse);
      const client = new WdkIndexerClient(CONFIG);

      const error = await client
        .getTokenBalance({ blockchain: 'ethereum', token: 'usdt', address: '0xa' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(WdkIndexerError);
      expect((error as WdkIndexerError).statusCode).toBe(500);
      expect((error as WdkIndexerError).code).toBe('HTTP_500');
    });
  });
});

describe('createIndexerClient', () => {
  it('returns null when no config is supplied', () => {
    expect(createIndexerClient(null)).toBeNull();
  });

  it('returns a client when a config is supplied', () => {
    const client = createIndexerClient(CONFIG);
    expect(client).toBeInstanceOf(WdkIndexerClient);
  });
});

describe('chainIdToIndexerBlockchain', () => {
  it('maps every supported ChainId to a non-empty indexer slug', () => {
    expect(chainIdToIndexerBlockchain('ethereum')).toBe('ethereum');
    expect(chainIdToIndexerBlockchain('arbitrum')).toBe('arbitrum');
    expect(chainIdToIndexerBlockchain('polygon')).toBe('polygon');
    expect(chainIdToIndexerBlockchain('plasma')).toBe('plasma');
    expect(chainIdToIndexerBlockchain('sepolia')).toBe('sepolia');
    expect(chainIdToIndexerBlockchain('spark')).toBe('spark');
  });
});
