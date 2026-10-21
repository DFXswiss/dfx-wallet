import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRefreshMutate = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useRefreshBalance: () => ({ mutate: mockRefreshMutate }),
}));

import { useRefreshBalances } from '../../src/services/balances/useRefreshBalances';
import { EVM_BALANCES_QUERY_KEY_PREFIX } from '../../src/services/balances/useEvmBalances';

function wrap({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useRefreshBalances', () => {
  beforeEach(() => {
    mockRefreshMutate.mockReset();
  });

  it('returns a callback that invalidates EVM queries + triggers WDK refresh on account 0 by default', () => {
    const { result } = renderHook(() => useRefreshBalances(), { wrapper: wrap });
    result.current();
    expect(mockRefreshMutate).toHaveBeenCalledWith({ accountIndex: 0, type: 'wallet' });
  });

  it('forwards a custom accountIndex to the WDK refresh mutation', () => {
    const { result } = renderHook(() => useRefreshBalances(), { wrapper: wrap });
    result.current(3);
    expect(mockRefreshMutate).toHaveBeenCalledWith({ accountIndex: 3, type: 'wallet' });
  });

  it('invalidates the EVM TanStack queries by the documented prefix', () => {
    // Render with a real QueryClient so we can spy on invalidateQueries.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    function withSpyClient({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useRefreshBalances(), { wrapper: withSpyClient });
    result.current();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: EVM_BALANCES_QUERY_KEY_PREFIX });
  });
});
