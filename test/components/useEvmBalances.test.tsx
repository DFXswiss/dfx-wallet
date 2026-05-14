import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The components project's moduleNameMapper points
// `@tetherto/wdk-react-native-core` at `test/__mocks__/wdk.ts`, so we
// reach into that mock at runtime and override `useAccount` per test.
import { useAccount } from '@tetherto/wdk-react-native-core';

// Stub the RPC fetch so the query function returns a deterministic balance
// map without hitting the network. We use the global `fetch` because the
// `EvmBalanceFetcher` defaults `fetchImpl` to it.
const originalFetch = global.fetch;

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
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => [{ jsonrpc: '2.0', id: 1, result: '0x0de0b6b3a7640000' }], // 1 ETH
      } as unknown as Response;
    }) as unknown as typeof fetch;
    // Stub `useAccount` so ethereum has an address and the other chains
    // do not — exercises both branches of `addressByChain`.
    (useAccount as jest.Mock).mockImplementation(({ network }: { network: string }) =>
      network === 'ethereum' ? { address: '0xfeedface' } : { address: null },
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
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
    // Override `useAccount` to return null addresses for every chain.
    (useAccount as jest.Mock).mockReturnValue({ address: null });
    const assets = getAssets(['ethereum']).filter((a) => a.getId() === 'ethereum-native');
    const { result } = renderHook(() => useEvmBalances(assets), { wrapper: wrap });
    // No address → enabled=false → no fetch + empty map.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data.size).toBe(0);
  });

  it('filters out non-EVM strategy assets so the query stays disabled if only WDK assets are passed', () => {
    (useAccount as jest.Mock).mockImplementation(({ network }: { network: string }) =>
      network === 'ethereum' ? { address: '0xfeedface' } : { address: null },
    );
    // Bitcoin native is WDK-strategy, not EVM — the hook must skip it.
    const wdkAssets = getAssets(['bitcoin']).filter((a) => a.getId() === 'bitcoin-native');
    const { result } = renderHook(() => useEvmBalances(wdkAssets), { wrapper: wrap });
    expect(result.current.data.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });
});
