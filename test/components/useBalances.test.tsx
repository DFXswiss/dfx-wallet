import { renderHook } from '@testing-library/react-native';
import type {
  BalanceEntry,
  BalanceMap,
  BalanceSourceResult,
} from '../../src/services/balances';

// Both source hooks are mocked at module level so the coordinator runs in
// isolation. Each test sets the next value the mocks should return before
// the renderHook call.
let mockWdkResult: BalanceSourceResult = { data: new Map(), isLoading: false, error: null };
let mockEvmResult: BalanceSourceResult = { data: new Map(), isLoading: false, error: null };

jest.mock('../../src/services/balances/useWdkBalances', () => ({
  useWdkBalances: (): BalanceSourceResult => mockWdkResult,
}));
jest.mock('../../src/services/balances/useEvmBalances', () => ({
  useEvmBalances: (): BalanceSourceResult => mockEvmResult,
}));

import { getRawBalance, useBalances } from '../../src/services/balances';

function entry(assetId: string, rawBalance: string): BalanceEntry {
  return { assetId, rawBalance, status: 'ok', source: 'wdk' };
}

function evmEntry(assetId: string, rawBalance: string): BalanceEntry {
  return { assetId, rawBalance, status: 'ok', source: 'evm' };
}

describe('useBalances coordinator', () => {
  beforeEach(() => {
    mockWdkResult = { data: new Map(), isLoading: false, error: null };
    mockEvmResult = { data: new Map(), isLoading: false, error: null };
  });

  it('merges WDK + EVM source maps into a single keyed map', () => {
    mockWdkResult = {
      data: new Map([['bitcoin-native', entry('bitcoin-native', '100000000')]]),
      isLoading: false,
      error: null,
    };
    mockEvmResult = {
      data: new Map([['ethereum-native', evmEntry('ethereum-native', '1000000000000000000')]]),
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useBalances([]));
    expect(result.current.data.size).toBe(2);
    expect(result.current.data.get('bitcoin-native')?.rawBalance).toBe('100000000');
    expect(result.current.data.get('ethereum-native')?.rawBalance).toBe('1000000000000000000');
  });

  it('lets EVM source overwrite WDK entries on the same asset id (last-write wins)', () => {
    const dup = 'ethereum-native';
    mockWdkResult = {
      data: new Map([[dup, entry(dup, '1')]]),
      isLoading: false,
      error: null,
    };
    mockEvmResult = {
      data: new Map([[dup, evmEntry(dup, '999')]]),
      isLoading: false,
      error: null,
    };
    const { result } = renderHook(() => useBalances([]));
    expect(result.current.data.get(dup)?.rawBalance).toBe('999');
    expect(result.current.data.get(dup)?.source).toBe('evm');
  });

  it('isLoading is true if either source is loading', () => {
    mockWdkResult = { data: new Map(), isLoading: true, error: null };
    const a = renderHook(() => useBalances([]));
    expect(a.result.current.isLoading).toBe(true);

    mockWdkResult = { data: new Map(), isLoading: false, error: null };
    mockEvmResult = { data: new Map(), isLoading: true, error: null };
    const b = renderHook(() => useBalances([]));
    expect(b.result.current.isLoading).toBe(true);
  });

  it('isLoading is false when neither source is loading', () => {
    const { result } = renderHook(() => useBalances([]));
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces the first non-null source error', () => {
    const err = new Error('rpc down');
    mockEvmResult = { data: new Map(), isLoading: false, error: err };
    const { result } = renderHook(() => useBalances([]));
    expect(result.current.error).toBe(err);
  });

  it('produces a stable Map reference across renders when sources are unchanged', () => {
    // useMemo is the contract — same wdk.data + evm.data refs ⇒ same merged
    // map ref so downstream React.memo / useMemo dependencies don't churn.
    const { result, rerender } = renderHook(() => useBalances([]));
    const first = result.current.data;
    rerender({});
    expect(result.current.data).toBe(first);
  });
});

describe('getRawBalance helper', () => {
  function map(): BalanceMap {
    return new Map([['x', entry('x', '42')]]);
  }
  it('returns the stored rawBalance', () => {
    expect(getRawBalance(map(), 'x')).toBe('42');
  });
  it('returns "0" for an unknown asset id (no defensive null surfaces to UI)', () => {
    expect(getRawBalance(map(), 'unknown')).toBe('0');
  });
});
