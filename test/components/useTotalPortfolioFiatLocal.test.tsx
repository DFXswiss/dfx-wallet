import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from '@/services/balances';
import { useTotalPortfolioFiat } from '@/features/portfolio/useTotalPortfolioFiatLocal';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { useWalletStore } from '@/store';

// Mock the balance coordinator before importing the hook so we control which
// assets the hook sees and what raw balances it sums.
let mockBalanceMap: BalanceMap = new Map();
jest.mock('@/services/balances', () => {
  const actual = jest.requireActual('@/services/balances');
  return {
    ...actual,
    useBalances: (): BalanceSourceResult => ({
      data: mockBalanceMap,
      isLoading: false,
      error: null,
    }),
  };
});

// Pin the pricing service to a deterministic state for the whole suite —
// USDT-in-USD = 1, BTC-in-USD = 50_000. The real singleton would hit
// CoinGecko on `initialize`, which is exactly what we want to avoid in a
// unit test.
beforeAll(() => {
  jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
  jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
  jest.spyOn(pricingService, 'getExchangeRate').mockImplementation((ticker, currency) => {
    if (currency !== FiatCurrency.USD) return undefined;
    if (ticker === 'usdt') return 1;
    if (ticker === 'btc') return 50_000;
    return undefined;
  });
});

function makeEntry(assetId: string, rawBalance: string): BalanceEntry {
  return {
    assetId,
    rawBalance,
    status: 'ok',
    source: 'wdk',
  };
}

// Asset ids in `tokens.ts` are `<network>-<contract>` (ERC-20) or
// `<network>-native`. We use USDT-on-Ethereum, whose canonicalSymbol is
// "USD" and decimals are 6; the local-MVP hook skips native categories
// entirely (BTC / ETH native are summed elsewhere in the full pipeline),
// so we can't exercise BTC native here — that's `useTotalPortfolioFiatFull`'s
// job. WBTC-on-Ethereum is the testable stand-in for a non-stable token
// that goes through the pricing-service rate path.
const USDT_ETH_ID = 'ethereum-0xdac17f958d2ee523a2206206994597c13d831ec7';
const WBTC_ETH_ID = 'ethereum-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';

function setBalances(entries: Record<string, string>) {
  mockBalanceMap = new Map(Object.entries(entries).map(([k, v]) => [k, makeEntry(k, v)]));
}

describe('useTotalPortfolioFiat (local / MVP variant)', () => {
  beforeEach(() => {
    setBalances({});
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'USD' });
  });

  it('returns 0 when the user holds nothing', async () => {
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(0));
    expect(useWalletStore.getState().totalBalanceFiat).toBe('0');
  });

  it('sums a 1-USDT holding to 1 USD (stablecoin short-circuit, no rate lookup)', async () => {
    setBalances({ [USDT_ETH_ID]: '1000000' }); // 1 USDT (6 decimals).
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(1));
    expect(useWalletStore.getState().totalBalanceFiat).toBe('1');
  });

  it('rounds the persisted total to two decimals (raw 0.12345 → "0.12")', async () => {
    setBalances({ [USDT_ETH_ID]: '123450' }); // 0.12345 USDT
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBeCloseTo(0.12345, 5));
    expect(useWalletStore.getState().totalBalanceFiat).toBe('0.12');
  });

  it('multiplies a WBTC holding through the pricing-service rate', async () => {
    setBalances({ [WBTC_ETH_ID]: '100000000' }); // 1 WBTC (8 decimals)
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(50_000));
  });

  it('reacts when the selectedCurrency changes', async () => {
    setBalances({ [USDT_ETH_ID]: '1000000' });
    const { result, rerender } = renderHook(() => useTotalPortfolioFiat());

    await waitFor(() => expect(result.current).toBe(1));

    act(() => {
      useWalletStore.setState({ selectedCurrency: 'CHF' });
    });
    rerender({});

    // USDT-in-CHF: the short-circuit only kicks in for matching currency.
    // The mock returns undefined for non-USD rates, so computeFiatValue
    // falls through to 0 — the assertion is that the hook re-evaluates
    // when the currency changes (rather than holding the old USD result).
    await waitFor(() => expect(result.current).toBe(0));
  });
});
