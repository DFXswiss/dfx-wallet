import { EvmBalanceFetcher, type EvmAssetSpec } from '../../src/services/balances/evm-fetcher';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

function mockOkResponse<T>(body: T): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

function mockErrorResponse(): Response {
  return { ok: false, status: 500, statusText: 'boom' } as unknown as Response;
}

const ETH_RPC = 'https://eth.test.example';
const ARB_RPC = 'https://arb.test.example';

const resolveRpc = (network: string): string | undefined => {
  if (network === 'ethereum') return ETH_RPC;
  if (network === 'arbitrum') return ARB_RPC;
  return undefined;
};

describe('EvmBalanceFetcher', () => {
  it('fetches a native balance and an ERC-20 balance in a single batched POST', async () => {
    const fetchImpl = jest.fn(async () =>
      mockOkResponse([
        { jsonrpc: '2.0', id: 1, result: '0x16345785d8a0000' }, // 0.1 ETH in wei
        { jsonrpc: '2.0', id: 2, result: '0x0f4240' }, // 1 USDC (6 decimals)
      ]),
    ) as unknown as FetchMock;

    const fetcher = new EvmBalanceFetcher(resolveRpc, fetchImpl);
    const specs: EvmAssetSpec[] = [
      { assetId: 'ethereum-native', network: 'ethereum', isNative: true, tokenAddress: null },
      { assetId: 'ethereum-usdc', network: 'ethereum', isNative: false, tokenAddress: '0xaaaa' },
    ];
    const result = await fetcher.fetch(specs, new Map([['ethereum', '0xdead']]));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchImpl.mock.calls[0]!;
    expect(calledUrl).toBe(ETH_RPC);
    const requestBody = JSON.parse(init!.body as string);
    expect(requestBody).toHaveLength(2);
    expect(requestBody[0].method).toBe('eth_getBalance');
    expect(requestBody[0].params[0]).toBe('0xdead');
    expect(requestBody[1].method).toBe('eth_call');
    // `balanceOf` selector with the holder address padded to 32 bytes.
    expect(requestBody[1].params[0].data).toBe(
      '0x70a08231000000000000000000000000000000000000000000000000000000000000dead',
    );

    expect(result.get('ethereum-native')).toEqual({
      assetId: 'ethereum-native',
      rawBalance: '100000000000000000', // 0.1 ETH in wei
    });
    expect(result.get('ethereum-usdc')).toEqual({
      assetId: 'ethereum-usdc',
      rawBalance: '1000000',
    });
  });

  it('fans out chains in parallel (one POST per chain)', async () => {
    const fetchImpl = jest.fn(async (url: RequestInfo | URL) => {
      if (url === ETH_RPC) {
        return mockOkResponse([{ jsonrpc: '2.0', id: 1, result: '0x01' }]);
      }
      if (url === ARB_RPC) {
        return mockOkResponse([{ jsonrpc: '2.0', id: 1, result: '0x02' }]);
      }
      throw new Error(`unexpected RPC: ${String(url)}`);
    }) as unknown as FetchMock;

    const fetcher = new EvmBalanceFetcher(resolveRpc, fetchImpl);
    const result = await fetcher.fetch(
      [
        { assetId: 'eth', network: 'ethereum', isNative: true, tokenAddress: null },
        { assetId: 'arb', network: 'arbitrum', isNative: true, tokenAddress: null },
      ],
      new Map([
        ['ethereum', '0xaaaa'],
        ['arbitrum', '0xbbbb'],
      ]),
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.get('eth')).toEqual({ assetId: 'eth', rawBalance: '1' });
    expect(result.get('arb')).toEqual({ assetId: 'arb', rawBalance: '2' });
  });

  it('reports "no rpc url" when the resolver returns undefined for a chain', async () => {
    const fetchImpl = jest.fn(async () => mockOkResponse([])) as unknown as FetchMock;
    const fetcher = new EvmBalanceFetcher((_: string) => undefined, fetchImpl);
    const result = await fetcher.fetch(
      [{ assetId: 'x', network: 'ethereum', isNative: true, tokenAddress: null }],
      new Map([['ethereum', '0xaaaa']]),
    );
    expect(result.get('x')).toEqual({ assetId: 'x', error: 'no rpc url' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports "no address" when the chain has no address in the map', async () => {
    const fetchImpl = jest.fn(async () => mockOkResponse([])) as unknown as FetchMock;
    const fetcher = new EvmBalanceFetcher(resolveRpc, fetchImpl);
    const result = await fetcher.fetch(
      [{ assetId: 'x', network: 'ethereum', isNative: true, tokenAddress: null }],
      new Map(),
    );
    expect(result.get('x')).toEqual({ assetId: 'x', error: 'no address' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports "token address missing" for an ERC-20 spec without a contract', async () => {
    const fetchImpl = jest.fn(async () =>
      mockOkResponse([{ jsonrpc: '2.0', id: 1, result: '0x01' }]),
    ) as unknown as FetchMock;
    const fetcher = new EvmBalanceFetcher(resolveRpc, fetchImpl);
    const result = await fetcher.fetch(
      [{ assetId: 'x', network: 'ethereum', isNative: false, tokenAddress: null }],
      new Map([['ethereum', '0xaaaa']]),
    );
    expect(result.get('x')).toEqual({ assetId: 'x', error: 'token address missing' });
    // No live request because the only spec on the chain is invalid.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('records per-asset RPC errors', async () => {
    const fetchImpl = jest.fn(async () =>
      mockOkResponse([
        { jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'invalid args' } },
      ]),
    ) as unknown as FetchMock;
    const fetcher = new EvmBalanceFetcher(resolveRpc, fetchImpl);
    const result = await fetcher.fetch(
      [{ assetId: 'x', network: 'ethereum', isNative: true, tokenAddress: null }],
      new Map([['ethereum', '0xaaaa']]),
    );
    expect(result.get('x')).toEqual({ assetId: 'x', error: 'invalid args' });
  });

  it('records an http-level error for a non-2xx response', async () => {
    const fetchImpl = jest.fn(async () => mockErrorResponse()) as unknown as FetchMock;
    const fetcher = new EvmBalanceFetcher(resolveRpc, fetchImpl);
    const result = await fetcher.fetch(
      [{ assetId: 'x', network: 'ethereum', isNative: true, tokenAddress: null }],
      new Map([['ethereum', '0xaaaa']]),
    );
    const entry = result.get('x');
    expect(entry).toBeDefined();
    expect('error' in entry!).toBe(true);
  });

  it('isolates per-chain failures (the other chain still resolves)', async () => {
    const fetchImpl = jest.fn(async (url: RequestInfo | URL) => {
      if (url === ETH_RPC) return mockErrorResponse();
      return mockOkResponse([{ jsonrpc: '2.0', id: 1, result: '0x05' }]);
    }) as unknown as FetchMock;
    const fetcher = new EvmBalanceFetcher(resolveRpc, fetchImpl);
    const result = await fetcher.fetch(
      [
        { assetId: 'eth', network: 'ethereum', isNative: true, tokenAddress: null },
        { assetId: 'arb', network: 'arbitrum', isNative: true, tokenAddress: null },
      ],
      new Map([
        ['ethereum', '0xaaaa'],
        ['arbitrum', '0xbbbb'],
      ]),
    );
    // ARB succeeded.
    expect(result.get('arb')).toEqual({ assetId: 'arb', rawBalance: '5' });
    // ETH failed but is still represented.
    expect('error' in result.get('eth')!).toBe(true);
  });
});
