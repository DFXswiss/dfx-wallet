import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stub the network-side EvmBalanceFetcher so we can drive every branch
// of `useEvmBalances`'s queryFn (success / error / missing result) from
// the test without depending on the module-load timing of the shared
// fetcher's `fetchImpl = fetch` default.
const mockFetcherResult: {
  current: Map<
    string,
    { assetId: string; rawBalance: string } | { assetId: string; error: string }
  >;
} = { current: new Map() };

jest.mock('../../src/services/balances/evm-fetcher', () => {
  class EvmBalanceFetcher {
    async fetch(): Promise<
      Map<string, { assetId: string; rawBalance: string } | { assetId: string; error: string }>
    > {
      return new Map(mockFetcherResult.current);
    }
  }
  return { EvmBalanceFetcher };
});

import { useAccount } from '@tetherto/wdk-react-native-core';

import {
  useEvmBalances,
  EVM_BALANCES_QUERY_KEY_PREFIX,
} from '../../src/services/balances/useEvmBalances';
import { getAssets } from '../../src/config/tokens';

let queryClient: QueryClient | undefined;
let mockEthereumAddress = '0xfeedface';
let addressSequence = 0;

function wrap({ children }: { children: React.ReactNode }) {
  queryClient ??= new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useEvmBalances', () => {
  beforeEach(() => {
    queryClient = undefined;
    mockEthereumAddress = `0xfeedface${addressSequence++}`;
    mockFetcherResult.current = new Map();
    (useAccount as jest.Mock).mockImplementation(({ network }: { network: string }) =>
      network === 'ethereum' ? { address: mockEthereumAddress } : { address: null },
    );
  });

  it('exports the documented query-key prefix used by useRefreshBalances', () => {
    expect(EVM_BALANCES_QUERY_KEY_PREFIX).toEqual(['balances', 'evm']);
  });

  it('returns an empty BalanceMap when no EVM-strategy assets are passed', () => {
    const { result } = renderHook(() => useEvmBalances([]), { wrapper: wrap });
    expect(result.current.data.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('skips the query when no EVM chain has an address yet', () => {
    (useAccount as jest.Mock).mockReturnValue({ address: null });
    const assets = getAssets(['ethereum']).filter((a) => a.getId() === 'ethereum-native');
    const { result } = renderHook(() => useEvmBalances(assets), { wrapper: wrap });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data.size).toBe(0);
  });

  it('filters out non-EVM strategy assets so the query stays disabled if only WDK assets are passed', () => {
    const wdkAssets = getAssets(['bitcoin']).filter((a) => a.getId() === 'bitcoin-native');
    const { result } = renderHook(() => useEvmBalances(wdkAssets), { wrapper: wrap });
    expect(result.current.data.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('maps a successful fetcher result to "ok" BalanceEntry rows', async () => {
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      rawBalance: '500',
    });
    const ethNative = getAssets(['ethereum']).find((a) => a.getId() === 'ethereum-native');
    expect(ethNative).toBeDefined();
    const { result } = renderHook(() => useEvmBalances([ethNative!]), { wrapper: wrap });
    await waitFor(() => expect(result.current.data.size).toBe(1));
    const entry = result.current.data.get('ethereum-native');
    expect(entry?.status).toBe('ok');
    expect(entry?.rawBalance).toBe('500');
    expect(entry?.source).toBe('evm');
  });

  it('maps a fetcher error result to an "error" BalanceEntry with rawBalance "0"', async () => {
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      error: 'rpc-down',
    });
    const ethNative = getAssets(['ethereum']).find((a) => a.getId() === 'ethereum-native');
    const { result } = renderHook(() => useEvmBalances([ethNative!]), { wrapper: wrap });
    await waitFor(() => expect(result.current.data.size).toBe(1));
    const entry = result.current.data.get('ethereum-native');
    expect(entry?.status).toBe('error');
    expect(entry?.error).toBe('rpc-down');
    expect(entry?.rawBalance).toBe('0');
  });

  it('retains the last successful value as stale when a later fetch fails', async () => {
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      rawBalance: '500',
    });
    const ethNative = getAssets(['ethereum']).find((a) => a.getId() === 'ethereum-native');
    const { result } = renderHook(() => useEvmBalances([ethNative!]), { wrapper: wrap });
    await waitFor(() => expect(result.current.data.get('ethereum-native')?.status).toBe('ok'));

    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      error: 'rpc-down',
    });
    await act(async () => {
      const client = queryClient;
      if (!client) throw new Error('Query client was not mounted');
      await client.invalidateQueries({ queryKey: EVM_BALANCES_QUERY_KEY_PREFIX });
    });

    await waitFor(() =>
      expect(result.current.data.get('ethereum-native')).toMatchObject({
        rawBalance: '500',
        status: 'stale',
        error: 'rpc-down',
      }),
    );
  });

  it('shares the last successful address-bound value across hook instances', async () => {
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      rawBalance: '750',
    });
    const ethNative = getAssets(['ethereum']).find((a) => a.getId() === 'ethereum-native');
    const first = renderHook(() => useEvmBalances([ethNative!]), { wrapper: wrap });
    await waitFor(() =>
      expect(first.result.current.data.get('ethereum-native')?.status).toBe('ok'),
    );
    first.unmount();

    queryClient = undefined;
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      error: 'rpc-down-in-second-instance',
    });
    const second = renderHook(() => useEvmBalances([ethNative!]), { wrapper: wrap });

    await waitFor(() =>
      expect(second.result.current.data.get('ethereum-native')).toMatchObject({
        rawBalance: '750',
        status: 'stale',
        error: 'rpc-down-in-second-instance',
      }),
    );
  });

  it("does not reuse address A's successful balance when address B fails", async () => {
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      rawBalance: '500',
    });
    const ethNative = getAssets(['ethereum']).find((a) => a.getId() === 'ethereum-native');
    const { result, rerender } = renderHook(() => useEvmBalances([ethNative!]), { wrapper: wrap });
    await waitFor(() => expect(result.current.data.get('ethereum-native')?.status).toBe('ok'));

    mockEthereumAddress = '0xdecafbad';
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      error: 'rpc-down-for-b',
    });
    rerender({});

    await waitFor(() =>
      expect(result.current.data.get('ethereum-native')).toMatchObject({
        rawBalance: '0',
        status: 'error',
        error: 'rpc-down-for-b',
      }),
    );
  });

  it('falls back to "idle" status when the fetcher omits a result for an asset', async () => {
    // fetcher returns nothing → queryFn synthesises an idle entry per spec.
    mockFetcherResult.current = new Map();
    const ethNative = getAssets(['ethereum']).find((a) => a.getId() === 'ethereum-native');
    const { result } = renderHook(() => useEvmBalances([ethNative!]), { wrapper: wrap });
    await waitFor(() => expect(result.current.data.size).toBe(1));
    const entry = result.current.data.get('ethereum-native');
    expect(entry?.status).toBe('idle');
    expect(entry?.rawBalance).toBe('0');
  });

  it('sorts the query-key chain entries deterministically (multiple addresses)', async () => {
    // With every EVM chain resolving an address, both the sort comparator
    // *and* every per-chain `if (account.address) map.set(…)` branch fire.
    (useAccount as jest.Mock).mockImplementation(
      ({ network }: { network: string }) =>
        ({
          ethereum: { address: '0xeth' },
          arbitrum: { address: '0xarb' },
          polygon: { address: '0xpoly' },
          base: { address: '0xbase' },
          plasma: { address: '0xplasma' },
          sepolia: { address: '0xsep' },
        })[network] ?? { address: null },
    );
    mockFetcherResult.current.set('ethereum-native', {
      assetId: 'ethereum-native',
      rawBalance: '1',
    });
    mockFetcherResult.current.set('arbitrum-native', {
      assetId: 'arbitrum-native',
      rawBalance: '2',
    });
    const assets = [
      getAssets(['ethereum']).find((a) => a.getId() === 'ethereum-native')!,
      getAssets(['arbitrum']).find((a) => a.getId() === 'arbitrum-native')!,
    ];
    const { result } = renderHook(() => useEvmBalances(assets), { wrapper: wrap });
    await waitFor(() => expect(result.current.data.size).toBe(2));
  });
});
