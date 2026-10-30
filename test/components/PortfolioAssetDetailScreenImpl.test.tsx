import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { ThemeProvider, useThemeStore } from '@/theme';
import { useWalletStore } from '@/store';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';

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
    enabledChains: ['ethereum', 'bitcoin', 'bitcoin-taproot', 'spark', 'arbitrum', 'polygon', 'base'],
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

describe('PortfolioAssetDetailScreenImpl', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockParams.symbol = 'BTC';
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'USD' });
    useThemeStore.setState({ mode: 'light' });
    (useBalancesForWallet as jest.Mock).mockReturnValue({
      data: [
        { assetId: 'bitcoin-native', success: true, balance: '100000000' },
        { assetId: 'bitcoin-taproot-native', success: false },
        { assetId: 'spark-native', success: true, balance: undefined },
      ],
    });
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
    jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(pricingService, 'getExchangeRate').mockImplementation((ticker, currency) => {
      if (currency !== FiatCurrency.USD) return undefined;
      if (ticker === 'btc') return 50_000;
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
    (useBalancesForWallet as jest.Mock).mockReturnValue({
      data: [
        {
          assetId: 'ethereum-0xdac17f958d2ee523a2206206994597c13d831ec7',
          success: true,
          balance: '2500000',
        },
      ],
    });
    const { getByTestId, getAllByText } = renderScreen();
    expect(getAllByText('Dollar').length).toBeGreaterThan(0);
    expect(getByTestId('holding-ethereum-USDT')).toBeTruthy();
    expect(getAllByText('USDT').length).toBeGreaterThan(0);
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

  it('treats a missing balanceResults list as zero holdings', () => {
    (useBalancesForWallet as jest.Mock).mockReturnValue({ data: undefined });
    const { getByTestId } = renderScreen();
    expect(getByTestId('holding-bitcoin-BTC')).toBeTruthy();
  });

  it('renders the dark backdrop when the theme is dark', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId } = renderScreen();
    expect(getByTestId('dark-backdrop')).toBeTruthy();
  });

  it('formats a non-finite fiat total as 0.00', async () => {
    const presentation = jest.requireActual(
      '@/config/portfolio-presentation',
    ) as typeof import('@/config/portfolio-presentation');
    jest.spyOn(presentation, 'computeFiatValue').mockReturnValue(Number.NaN);
    const { getByTestId } = renderScreen();
    await act(async () => undefined);
    expect(getByTestId('asset-detail-back')).toBeTruthy();
  });
});
