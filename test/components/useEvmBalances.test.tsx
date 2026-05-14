import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stub the network-side EvmBalanceFetcher so we can drive every branch
// of `useEvmBalances`'s queryFn (success / error / missing result) from
// the test without depending on the module-load timing of the shared
// fetcher's `fetchImpl = fetch` default.
const mockFetcherResult: {
  current: Map<string, { assetId: string; rawBalance: string } | { assetId: string; error: string }>;
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

import { useEvmBalances, EVM_BALANCES_QUERY_KEY_PREFIX } from '../../src/services/balances/useEvmBalances';
import { getAssets } from '../../src/config/tokens';

function wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useEvmBalances', () => {
  beforeEach(() => {
    mockFetcherResult.current = new Map();
    (useAccount as jest.Mock).mockImplementation(({ network }: { network: string }) =>
      network === 'ethereum' ? { address: '0xfeedface' } : { address: null },
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
});
