import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from '@/services/balances';
import type { ChainId } from '@/config/chains';
import {
  assetIncludedInEvmBalanceQuery,
  assetIncludedInWdkBalanceQuery,
  getAssetMeta,
  getAssets,
} from '@/config/tokens';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { lightColors, ThemeProvider, useThemeStore } from '@/theme';
import { useWalletStore } from '@/store';

let mockBalanceMap: BalanceMap = new Map();
let mockBalancesLoading = false;
let mockBalancesError: Error | null = null;
let mockBtcRate: number | undefined = 50_000;
let mockBtcRateCurrency: FiatCurrency = FiatCurrency.USD;
let mockEnabledChains: ChainId[] = [];
jest.mock('@/services/balances', () => {
  const actual = jest.requireActual('@/services/balances');
  return {
    ...actual,
    useBalances: (): BalanceSourceResult => ({
      data: mockBalanceMap,
      isLoading: mockBalancesLoading,
      error: mockBalancesError,
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockParams: { symbol?: string } = { symbol: 'BTC' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({
    enabledChains: mockEnabledChains,
    setEnabledChains: jest.fn(),
    toggleChain: jest.fn(),
  }),
}));

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const actual = jest.requireActual('@/components');
  return {
    ...actual,
    AssetActions: ({ testID }: { testID?: string }) =>
      ReactActual.createElement(View, { testID }, ReactActual.createElement(Text, null, 'actions')),
    Icon: ({ name }: { name: string }) => ReactActual.createElement(Text, null, name),
    DarkBackdrop: () => ReactActual.createElement(View, { testID: 'dark-backdrop' }),
  };
});

// eslint-disable-next-line import/first
import PortfolioAssetDetailScreenImpl from '../../src/features/portfolio/PortfolioAssetDetailScreenImpl';

function renderScreen() {
  return render(
    <ThemeProvider>
      <PortfolioAssetDetailScreenImpl />
    </ThemeProvider>,
  );
}

function balanceEntry(assetId: string, rawBalance: string, source: 'wdk' | 'evm'): BalanceEntry {
  return { assetId, rawBalance, status: 'ok', source };
}

function setCompleteBtcBalances() {
  mockBalanceMap = new Map(
    getAssets(mockEnabledChains)
      .filter((asset) => {
        const meta = getAssetMeta(asset.getId());
        return (
          meta?.canonicalSymbol === 'BTC' &&
          (assetIncludedInWdkBalanceQuery(asset) || assetIncludedInEvmBalanceQuery(asset))
        );
      })
      .map((asset) => {
        const source = getAssetMeta(asset.getId())?.balanceFetchStrategy === 'evm' ? 'evm' : 'wdk';
        const rawBalance = asset.getId() === 'bitcoin-native' ? '100000000' : '0';
        return [asset.getId(), balanceEntry(asset.getId(), rawBalance, source)];
      }),
  );
}

describe('PortfolioAssetDetailScreenImpl', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockParams.symbol = 'BTC';
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'USD' });
    useThemeStore.setState({ mode: 'light' });
    mockBalancesLoading = false;
    mockBalancesError = null;
    mockBtcRate = 50_000;
    mockBtcRateCurrency = FiatCurrency.USD;
    mockEnabledChains = [
      'ethereum',
      'bitcoin',
      'bitcoin-taproot',
      'spark',
      'arbitrum',
      'polygon',
      'base',
    ];
    setCompleteBtcBalances();
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
    jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(pricingService, 'getExchangeRate').mockImplementation((ticker, currency) => {
      if (currency !== mockBtcRateCurrency) return undefined;
      if (ticker === 'btc') return mockBtcRate;
      if (ticker === 'usdt') return 1;
      return undefined;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the Bitcoin detail shell and goes back', () => {
    const { getByTestId, getAllByText } = renderScreen();
    expect(getByTestId('asset-detail-back')).toBeTruthy();
    expect(getAllByText('Bitcoin').length).toBeGreaterThan(0);
    fireEvent.press(getByTestId('asset-detail-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('opens transaction history when a holding row is pressed', () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('holding-bitcoin-BTC'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/transaction-history',
      params: { asset: 'BTC', network: 'bitcoin' },
    });
  });

  it('labels BTC variants (SegWit / Taproot / Lightning) and falls back for unknown networks', () => {
    const { getByText } = renderScreen();
    expect(getByText('SegWit')).toBeTruthy();
    expect(getByText('Taproot')).toBeTruthy();
    expect(getByText('Lightning')).toBeTruthy();
  });

  it('renders a non-BTC group with the token symbol on top when it differs from the canonical', () => {
    mockParams.symbol = 'USD';
    const assetId = 'ethereum-0xdac17f958d2ee523a2206206994597c13d831ec7';
    mockBalanceMap = new Map([[assetId, balanceEntry(assetId, '2500000', 'evm')]]);
    const { getByTestId, getAllByText } = renderScreen();
    expect(getAllByText('Dollar').length).toBeGreaterThan(0);
    expect(getByTestId('holding-ethereum-USDT')).toBeTruthy();
    expect(getAllByText('USDT').length).toBeGreaterThan(0);
    expect(getAllByText('2.50 USDT').length).toBeGreaterThan(0);
  });

  it('treats a missing symbol param as an empty canonical group', () => {
    delete mockParams.symbol;
    const { getByTestId } = renderScreen();
    expect(getByTestId('asset-detail-back')).toBeTruthy();
  });

  it('uses the CHF / EUR currency glyphs', () => {
    useWalletStore.setState({ selectedCurrency: 'CHF' });
    const chf = renderScreen();
    expect(chf.getAllByText(/CHF/).length).toBeGreaterThan(0);
    chf.unmount();

    useWalletStore.setState({ selectedCurrency: 'EUR' });
    const eur = renderScreen();
    expect(eur.getAllByText(/€/).length).toBeGreaterThan(0);
  });

  it('initializes pricing when cold and swallows initialize failure', async () => {
    jest.spyOn(pricingService, 'isReady').mockReturnValue(false);
    const init = jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    const { getByTestId, unmount } = renderScreen();
    await waitFor(() => expect(init).toHaveBeenCalled());
    expect(getByTestId('asset-detail-back')).toBeTruthy();
    unmount();

    jest.spyOn(pricingService, 'isReady').mockReturnValue(false);
    jest.spyOn(pricingService, 'initialize').mockRejectedValue(new Error('offline'));
    const again = renderScreen();
    await waitFor(() => expect(again.getByTestId('asset-detail-back')).toBeTruthy());
  });

  it('marks pricing ready immediately when the service is already warm', () => {
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
    const { getByTestId } = renderScreen();
    expect(getByTestId('asset-detail-back')).toBeTruthy();
  });

  it('shows an incomplete placeholder when a queried balance entry is missing', () => {
    mockBalanceMap = new Map();
    const { getByTestId, getByText } = renderScreen();
    expect(within(getByTestId('holding-bitcoin-BTC')).getAllByText('—')).toHaveLength(2);
    expect(getByTestId('asset-detail-total-crypto').props.children).toBe('—');
    expect(getByText('portfolio.balanceUnavailable')).toBeTruthy();
  });

  it('uses warningText for the incomplete balance status', () => {
    mockBalanceMap = new Map();
    const { getByTestId } = renderScreen();
    const statusStyle = StyleSheet.flatten(
      getByTestId('asset-detail-balance-incomplete').props.style,
    );

    expect(statusStyle.color).toBe(lightColors.warningText);
    expect(statusStyle.color).not.toBe(lightColors.warning);
  });

  it('does not let a never-queried holding mask complete group totals', () => {
    mockEnabledChains = ['bitcoin', 'bitcoin-taproot', 'spark'];
    setCompleteBtcBalances();

    const { getByTestId, queryByText } = renderScreen();

    expect(getByTestId('asset-detail-total-crypto').props.children).toBe('1.00 BTC');
    expect(within(getByTestId('holding-bitcoin-taproot-BTC')).getAllByText('—')).toHaveLength(2);
    expect(within(getByTestId('holding-bitcoin-BTC')).getByText('1.00 BTC')).toBeTruthy();
    expect(within(getByTestId('holding-spark-BTC')).getByText('0 BTC')).toBeTruthy();
    expect(queryByText('portfolio.balanceUnavailable')).toBeNull();
  });

  it.each(['loading', 'error', 'stale', 'idle'] as const)(
    'shows unavailable for a queried holding with %s status',
    (status) => {
      const bitcoin = mockBalanceMap.get('bitcoin-native');
      if (!bitcoin) throw new Error('Expected Bitcoin fixture');
      mockBalanceMap = new Map(mockBalanceMap).set('bitcoin-native', { ...bitcoin, status });

      const { getByTestId } = renderScreen();

      expect(within(getByTestId('holding-bitcoin-BTC')).getAllByText('—')).toHaveLength(2);
    },
  );

  it('shows a loading placeholder instead of zero while balances load', () => {
    mockBalanceMap = new Map();
    mockBalancesLoading = true;

    const { getByTestId, getByText } = renderScreen();

    expect(getByTestId('asset-detail-total-crypto').props.children).toBe('—');
    expect(getByTestId('asset-detail-total-fiat').props.children).toBe('—');
    expect(getByText('portfolio.balanceLoading')).toBeTruthy();
  });

  it('does not mask BTC detail totals when an unrelated balance source errors', () => {
    mockEnabledChains = ['ethereum', 'bitcoin', 'spark'];
    setCompleteBtcBalances();
    mockBalancesError = new Error('evm-rpc-down');

    const { getByTestId, queryByTestId } = renderScreen();

    expect(getByTestId('asset-detail-total-crypto').props.children).toBe('1.00 BTC');
    expect(queryByTestId('asset-detail-balance-incomplete')).toBeNull();
  });

  it('shows unavailable when a holding in the displayed asset group errors', () => {
    mockEnabledChains = ['bitcoin', 'bitcoin-taproot', 'spark'];
    setCompleteBtcBalances();
    const bitcoin = mockBalanceMap.get('bitcoin-native');
    if (!bitcoin) throw new Error('Expected Bitcoin fixture');
    mockBalanceMap = new Map(mockBalanceMap).set('bitcoin-native', {
      ...bitcoin,
      status: 'error',
    });
    mockBalancesError = new Error('bitcoin-down');

    const { getByTestId, getByText } = renderScreen();

    expect(getByTestId('asset-detail-total-crypto').props.children).toBe('—');
    expect(getByText('portfolio.balanceUnavailable')).toBeTruthy();
  });

  it('shows an unavailable placeholder for a stale balance entry', () => {
    const bitcoin = mockBalanceMap.get('bitcoin-native');
    if (!bitcoin) throw new Error('Expected Bitcoin fixture');
    mockBalanceMap = new Map(mockBalanceMap).set('bitcoin-native', {
      ...bitcoin,
      status: 'stale',
    });

    const { getByTestId, getByText } = renderScreen();

    expect(getByTestId('asset-detail-total-crypto').props.children).toBe('—');
    expect(getByText('portfolio.balanceUnavailable')).toBeTruthy();
  });

  it('recomputes fiat values when the pricing service publishes an update', async () => {
    mockEnabledChains = ['ethereum', 'bitcoin', 'spark'];
    setCompleteBtcBalances();
    const { getByTestId } = renderScreen();
    const fiatDigits = () =>
      String(getByTestId('asset-detail-total-fiat').props.children).replace(/\D/g, '');
    expect(fiatDigits()).toBe('5000000');

    mockBtcRate = 60_000;
    act(() => pricingService.reset());

    await waitFor(() => expect(fiatDigits()).toBe('6000000'));
  });

  it('shows unavailable fiat for a positive balance without a finite rate', () => {
    mockBtcRate = undefined;

    const missing = renderScreen();

    expect(missing.getByTestId('asset-detail-total-crypto').props.children).toBe('1.00 BTC');
    expect(missing.getByTestId('asset-detail-total-fiat').props.children).toBe('—');
    expect(within(missing.getByTestId('holding-bitcoin-BTC')).getByText('—')).toBeTruthy();
    expect(within(missing.getByTestId('holding-spark-BTC')).getByText('$ 0.00')).toBeTruthy();
    expect(missing.getByText('dashboard.incompleteBalance')).toBeTruthy();
    missing.unmount();

    mockBtcRate = 50_000;
    const available = renderScreen();
    const totalFiat = String(available.getByTestId('asset-detail-total-fiat').props.children);

    expect(totalFiat.replace(/\D/g, '')).toBe('5000000');
    expect(within(available.getByTestId('holding-bitcoin-BTC')).queryByText('—')).toBeNull();
    expect(available.queryByText('dashboard.incompleteBalance')).toBeNull();
  });

  it('renders the dark backdrop when the theme is dark', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId } = renderScreen();
    expect(getByTestId('dark-backdrop')).toBeTruthy();
  });

  it('shows unavailable fiat when a positive balance computes to a non-finite value', async () => {
    const presentation = jest.requireActual(
      '@/config/portfolio-presentation',
    ) as typeof import('@/config/portfolio-presentation');
    jest.spyOn(presentation, 'computeFiatValue').mockReturnValue(Number.NaN);
    mockBtcRateCurrency = FiatCurrency.CHF;
    useWalletStore.setState({ selectedCurrency: 'CHF' });
    const { getByTestId, getByText } = renderScreen();
    await act(async () => undefined);
    expect(getByTestId('asset-detail-total-fiat').props.children).toBe('—');
    expect(within(getByTestId('holding-bitcoin-BTC')).getByText('—')).toBeTruthy();
    expect(getByText('dashboard.incompleteBalance')).toBeTruthy();
  });
});
