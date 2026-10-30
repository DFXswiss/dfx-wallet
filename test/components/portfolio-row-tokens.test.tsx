import React from 'react';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from '@/services/balances';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { Skeleton } from '@/components';
import { Card, IconTile, ThemeProvider, lightColors } from '@/theme';
import { useAuthStore, useWalletStore } from '@/store';
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
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: jest.fn(),
    canGoBack: () => true,
  }),
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
    enabledChains: [
      'ethereum',
      'bitcoin',
      'bitcoin-taproot',
      'spark',
      'arbitrum',
      'polygon',
      'base',
    ],
    setEnabledChains: jest.fn(),
    toggleChain: jest.fn(),
  }),
}));

let mockBalanceMap: BalanceMap | undefined;
jest.mock('@/services/balances', () => {
  const actual = jest.requireActual('@/services/balances');
  return {
    ...actual,
    useBalances: (): BalanceSourceResult => ({
      data: mockBalanceMap as BalanceMap,
      isLoading: false,
      error: null,
    }),
  };
});

jest.mock('@/features/linked-wallets/useLinkedWalletSelection', () => ({
  useLinkedWalletSelection: () => ({ isSelected: () => true }),
}));

jest.mock('@/features/linked-wallets/useLinkedWalletNames', () => ({
  useLinkedWalletNames: () => ({ getName: () => null }),
  defaultLinkedWalletName: (bc: string | null | undefined) => (bc ? `DFX ${bc}` : 'DFX Wallet'),
}));

jest.mock('@/features/linked-wallets/useLinkedWalletDiscovery', () => ({
  useLinkedWalletDiscovery: () => ({
    data: new Map(),
    isLoading: false,
    refetch: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxUserService: {
    getUser: jest.fn(async () => ({ addresses: [], activeAddress: null })),
  },
}));

// eslint-disable-next-line import/first
import PortfolioScreenImpl from '../../src/features/portfolio/PortfolioScreenImpl';
// eslint-disable-next-line import/first
import PortfolioAssetDetailScreenImpl from '../../src/features/portfolio/PortfolioAssetDetailScreenImpl';

const WBTC_ETH_ID = 'ethereum-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';

function entry(assetId: string, rawBalance: string): BalanceEntry {
  return { assetId, rawBalance, status: 'ok', source: 'wdk' };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  const resolved =
    typeof style === 'function'
      ? (style as (args: { pressed: boolean }) => unknown)({ pressed: false })
      : style;
  return StyleSheet.flatten(resolved) as Record<string, unknown>;
}

function renderPortfolio() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <PortfolioScreenImpl />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function renderDetail() {
  return render(
    <ThemeProvider>
      <PortfolioAssetDetailScreenImpl />
    </ThemeProvider>,
  );
}

describe('portfolio list-row tokens', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockParams.symbol = 'BTC';
    mockBalanceMap = new Map([[WBTC_ETH_ID, entry(WBTC_ETH_ID, '100000000')]]);
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'USD' });
    useAuthStore.setState({ isDfxAuthenticated: false });
    (useBalancesForWallet as jest.Mock).mockReturnValue({
      data: [{ assetId: 'bitcoin-native', success: true, balance: '100000000' }],
    });
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
    jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(pricingService, 'getExchangeRate').mockImplementation((ticker, currency) => {
      if (currency !== FiatCurrency.USD) return undefined;
      if (ticker === 'btc') return 50_000;
      return undefined;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders portfolio cards and asset-detail holdings with the same card metrics', async () => {
    const portfolio = renderPortfolio();
    await waitFor(() => expect(portfolio.getByTestId('portfolio-asset-BTC')).toBeTruthy());
    const card = flattenStyle(portfolio.getByTestId('portfolio-asset-BTC').props.style);

    const detail = renderDetail();
    const holding = flattenStyle(detail.getByTestId('holding-bitcoin-BTC').props.style);

    expect(card.borderRadius).toBe(holding.borderRadius);
    expect(card.padding).toBe(holding.padding);
    expect(card.gap).toBe(holding.gap);
    expect(card.borderColor).toBe(holding.borderColor);

    expect(card.borderRadius).toBe(Card.radius);
    expect(card.padding).toBe(Card.padding);
    expect(card.gap).toBe(Card.gap);
    expect(card.borderColor).toBe(lightColors.cardOverlayBorder);
  });

  it('keeps the skeleton tile the same size and radius as the loaded asset tile', async () => {
    mockBalanceMap = undefined;
    const skeletonScreen = renderPortfolio();
    const iconSkeletons = skeletonScreen
      .UNSAFE_getAllByType(Skeleton)
      .filter((node) => node.props.width === node.props.height);
    expect(iconSkeletons.length).toBeGreaterThan(0);
    for (const node of iconSkeletons) {
      expect(node.props.width).toBe(IconTile.md.size);
      expect(node.props.height).toBe(IconTile.md.size);
      expect(node.props.radius).toBe(IconTile.md.radius);
    }
    skeletonScreen.unmount();

    mockBalanceMap = new Map([[WBTC_ETH_ID, entry(WBTC_ETH_ID, '100000000')]]);
    const loaded = renderPortfolio();
    await waitFor(() => expect(loaded.getByTestId('portfolio-asset-icon-BTC')).toBeTruthy());
    const tile = flattenStyle(loaded.getByTestId('portfolio-asset-icon-BTC').props.style);
    expect(tile.width).toBe(IconTile.md.size);
    expect(tile.height).toBe(IconTile.md.size);
    expect(tile.borderRadius).toBe(IconTile.md.radius);
  });
});
