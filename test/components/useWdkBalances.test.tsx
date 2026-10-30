import { renderHook } from '@testing-library/react-native';

type WdkBalanceRow =
  | { success: true; assetId: string; balance?: string | null }
  | { success: false; assetId: string; error?: string };

const mockWdkResult: {
  current: { data: WdkBalanceRow[] | undefined; isLoading: boolean; error: unknown };
} = {
  current: { data: undefined, isLoading: false, error: null },
};

jest.mock('@tetherto/wdk-react-native-core', () => {
  class BaseAsset {
    cfg: Record<string, unknown>;
    constructor(cfg: Record<string, unknown>) {
      this.cfg = cfg;
    }
    getId() {
      return this.cfg['id'] as string;
    }
    getDecimals() {
      return this.cfg['decimals'] as number;
    }
    getNetwork() {
      return this.cfg['network'] as string;
    }
    isNative() {
      return this.cfg['isNative'] as boolean;
    }
  }
  return {
    useBalancesForWallet: () => mockWdkResult.current,
    BaseAsset,
  };
});

import { useWdkBalances } from '../../src/services/balances/useWdkBalances';
import { getAssets } from '../../src/config/tokens';

describe('useWdkBalances', () => {
  beforeEach(() => {
    mockWdkResult.current = { data: undefined, isLoading: false, error: null };
  });

  it('returns an empty map when WDK has not produced data yet', () => {
    const { result } = renderHook(() => useWdkBalances(getAssets(['bitcoin'])));
    expect(result.current.data.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('maps a successful WDK row to an "ok" BalanceEntry', () => {
    mockWdkResult.current = {
      data: [{ success: true, assetId: 'bitcoin-native', balance: '12345' }],
      isLoading: false,
      error: null,
    };
    const { result } = renderHook(() => useWdkBalances(getAssets(['bitcoin'])));
    const entry = result.current.data.get('bitcoin-native');
    expect(entry).toBeDefined();
    expect(entry?.rawBalance).toBe('12345');
    expect(entry?.status).toBe('ok');
    expect(entry?.source).toBe('wdk');
  });

  it('defaults rawBalance to "0" when WDK returns success: true with null balance', () => {
    mockWdkResult.current = {
      data: [{ success: true, assetId: 'bitcoin-native', balance: null }],
      isLoading: false,
      error: null,
    };
    const { result } = renderHook(() => useWdkBalances(getAssets(['bitcoin'])));
    expect(result.current.data.get('bitcoin-native')?.rawBalance).toBe('0');
  });

  it('maps a failed WDK row to an "error" BalanceEntry with rawBalance "0"', () => {
    mockWdkResult.current = {
      data: [{ success: false, assetId: 'bitcoin-native', error: 'worklet timeout' }],
      isLoading: false,
      error: null,
    };
    const { result } = renderHook(() => useWdkBalances(getAssets(['bitcoin'])));
    const entry = result.current.data.get('bitcoin-native');
    expect(entry?.status).toBe('error');
    expect(entry?.error).toBe('worklet timeout');
    expect(entry?.rawBalance).toBe('0');
  });

  it('drops the error field when WDK reports failure without an error string', () => {
    // `r.error` undefined → the error entry is still returned but without
    // an `error` field. Exercises the `if (r.error)` false branch.
    mockWdkResult.current = {
      data: [{ success: false, assetId: 'bitcoin-native' }],
      isLoading: false,
      error: null,
    };
    const { result } = renderHook(() => useWdkBalances(getAssets(['bitcoin'])));
    const entry = result.current.data.get('bitcoin-native');
    expect(entry?.status).toBe('error');
    expect(entry?.error).toBeUndefined();
    expect(entry?.rawBalance).toBe('0');
  });

  it('forwards isLoading + error from the underlying WDK hook', () => {
    const someErr = new Error('worklet not ready');
    mockWdkResult.current = { data: undefined, isLoading: true, error: someErr };
    const { result } = renderHook(() => useWdkBalances(getAssets(['bitcoin'])));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(someErr);
  });
});
