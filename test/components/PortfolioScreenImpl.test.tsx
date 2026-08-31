import React from 'react';
import { RefreshControl } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from '@/services/balances';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import type { WalletDiscovery } from '@/features/linked-wallets/useLinkedWalletDiscovery';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { ThemeProvider, useThemeStore } from '@/theme';
import { useAuthStore, useWalletStore } from '@/store';
import { getAssets } from '@/config/tokens';

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
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
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
    enabledChains: ['ethereum', 'bitcoin', 'arbitrum'],
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

jest.mock('@/config/tokens', () => {
  const actual = jest.requireActual('@/config/tokens');
  return {
    ...actual,
    getAssets: jest.fn((...args: unknown[]) => actual.getAssets(...args)),
  };
});

const mockIsSelected = jest.fn((_address: string) => true);
jest.mock('@/features/linked-wallets/useLinkedWalletSelection', () => ({
  useLinkedWalletSelection: () => ({ isSelected: mockIsSelected }),
}));

const mockGetName = jest.fn((_address: string) => null as string | null);
jest.mock('@/features/linked-wallets/useLinkedWalletNames', () => ({
  useLinkedWalletNames: () => ({ getName: mockGetName }),
  defaultLinkedWalletName: (bc: string | null | undefined) => (bc ? `DFX ${bc}` : 'DFX Wallet'),
}));

const mockDiscovery = new Map<string, WalletDiscovery>();
const mockRefetchDiscovery = jest.fn(async () => undefined);
jest.mock('@/features/linked-wallets/useLinkedWalletDiscovery', () => ({
  useLinkedWalletDiscovery: () => ({
    data: mockDiscovery,
    isLoading: false,
    refetch: mockRefetchDiscovery,
  }),
}));

const mockGetUser = jest.fn();
jest.mock('@/features/dfx-backend/services', () => ({
  dfxUserService: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
}));

// eslint-disable-next-line import/first
import PortfolioScreenImpl from '../../src/features/portfolio/PortfolioScreenImpl';

const USDT_ETH_ID = 'ethereum-0xdac17f958d2ee523a2206206994597c13d831ec7';
const USDC_ETH_ID = 'ethereum-0xa0b86991c6218a36c1d19d4a2e9eb0ce3606eb48';
const USDT_ARB_ID = 'arbitrum-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9';
const WBTC_ETH_ID = 'ethereum-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
const ZCHF_ETH_ID = 'ethereum-0xb58e61c3098d85632df34eecfb899a1ed80921cb';
const ETH_NATIVE_ID = 'ethereum-native';

function entry(assetId: string, rawBalance: string): BalanceEntry {
  return { assetId, rawBalance, status: 'ok', source: 'wdk' };
}

function setBalances(entries: Record<string, string> | undefined) {
  if (entries === undefined) {
    mockBalanceMap = undefined;
    return;
  }
  mockBalanceMap = new Map(Object.entries(entries).map(([k, v]) => [k, entry(k, v)]));
}

const LONG_ADDR = '0x1111222233334444555566667777888899990000';
const SHORT_ADDR = '0xSHORT';
const ACTIVE_ADDR = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const WALLET_LONG: UserAddressDto = {
  address: LONG_ADDR,
  blockchain: 'Ethereum',
  blockchains: ['Ethereum', 'Arbitrum'],
};
const WALLET_SHORT: UserAddressDto = {
  address: SHORT_ADDR,
  blockchain: 'Bitcoin',
  blockchains: [],
};
const WALLET_ACTIVE: UserAddressDto = {
  address: ACTIVE_ADDR,
  blockchain: 'Ethereum',
  blockchains: ['Ethereum'],
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <PortfolioScreenImpl />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('PortfolioScreenImpl', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ addresses: [], activeAddress: null });
    mockRefetchDiscovery.mockReset();
    mockRefetchDiscovery.mockResolvedValue(undefined);
    mockIsSelected.mockReset();
    mockIsSelected.mockReturnValue(true);
    mockGetName.mockReset();
    mockGetName.mockReturnValue(null);
    mockDiscovery.clear();
    (getAssets as jest.Mock).mockReset();
    (getAssets as jest.Mock).mockImplementation(
      (...args: unknown[]) =>
        jest.requireActual('@/config/tokens').getAssets(...args),
    );
    setBalances({});
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'USD' });
    useAuthStore.setState({ isDfxAuthenticated: false });
    useThemeStore.setState({ mode: 'light' });
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
    jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(pricingService, 'refresh').mockResolvedValue(undefined);
    jest.spyOn(pricingService, 'getExchangeRate').mockImplementation((ticker, currency) => {
      if (currency !== FiatCurrency.USD) return undefined;
      if (ticker === 'usdt') return 1;
      if (ticker === 'btc') return 50_000;
      if (ticker === 'zchf') return 1.1;
      return undefined;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the portfolio shell and goes back / to manage', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('portfolio-back-button')).toBeTruthy();
    expect(getByTestId('portfolio-manage-button')).toBeTruthy();
    fireEvent.press(getByTestId('portfolio-back-button'));
    expect(mockBack).toHaveBeenCalled();
    fireEvent.press(getByTestId('portfolio-manage-button'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/portfolio/manage');
  });

  it('shows skeleton rows while balances have not resolved', () => {
    setBalances(undefined);
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('portfolio-empty')).toBeNull();
    expect(queryByTestId('portfolio-asset-BTC')).toBeNull();
  });

  it('does not throw when useBalances data is still undefined (first paint before query resolve)', () => {
    setBalances(undefined);
    expect(() => renderScreen()).not.toThrow();
  });

  it('shows the empty state when no non-native assets are configured', () => {
    (getAssets as jest.Mock).mockReturnValue([]);
    setBalances({});
    const { getByTestId } = renderScreen();
    expect(getByTestId('portfolio-empty')).toBeTruthy();
  });

  it('renders filled groups, merges networks, sorts BTC first, and navigates on tap', async () => {
    setBalances({
      [WBTC_ETH_ID]: '100000000',
      [USDT_ETH_ID]: '2000000',
      [USDC_ETH_ID]: '1000000',
      [USDT_ARB_ID]: '500000',
      [ZCHF_ETH_ID]: '0',
      [ETH_NATIVE_ID]: '1000000000000000000',
    });
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('portfolio-asset-BTC')).toBeTruthy());
    expect(getByTestId('portfolio-asset-USD')).toBeTruthy();

    fireEvent.press(getByTestId('portfolio-asset-BTC'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/portfolio/[symbol]',
      params: { symbol: 'BTC' },
    });
  });

  it('uses the CHF / EUR currency glyphs', () => {
    setBalances({ [USDT_ETH_ID]: '1000000' });
    useWalletStore.setState({ selectedCurrency: 'CHF' });
    const chf = renderScreen();
    expect(chf.getAllByText('CHF').length).toBeGreaterThan(0);
    chf.unmount();

    useWalletStore.setState({ selectedCurrency: 'EUR' });
    const eur = renderScreen();
    expect(eur.getAllByText('€').length).toBeGreaterThan(0);
  });

  it('initializes pricing when the service is cold, and swallows initialize failure', async () => {
    jest.spyOn(pricingService, 'isReady').mockReturnValue(false);
    const init = jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    setBalances({ [USDT_ETH_ID]: '1000000' });
    const { getByTestId, unmount } = renderScreen();
    await waitFor(() => expect(init).toHaveBeenCalled());
    expect(getByTestId('portfolio-back-button')).toBeTruthy();
    unmount();

    jest.spyOn(pricingService, 'isReady').mockReturnValue(false);
    jest.spyOn(pricingService, 'initialize').mockRejectedValue(new Error('offline'));
    const again = renderScreen();
    await waitFor(() => expect(again.getByTestId('portfolio-back-button')).toBeTruthy());
  });

  it('pull-to-refresh invalidates balances and re-pulls the DFX user when authenticated', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser.mockResolvedValue({
      addresses: [WALLET_LONG],
      activeAddress: WALLET_ACTIVE,
    });
    setBalances({ [USDT_ETH_ID]: '1000000' });
    const { UNSAFE_getByType } = renderScreen();
    await act(async () => {
      fireEvent(UNSAFE_getByType(RefreshControl), 'refresh');
    });
    expect(mockRefetchDiscovery).toHaveBeenCalled();
    expect(pricingService.refresh).toHaveBeenCalled();
    expect(mockGetUser).toHaveBeenCalled();
  });

  it('pull-to-refresh skips the DFX user when unauthenticated and swallows refresh errors', async () => {
    useAuthStore.setState({ isDfxAuthenticated: false });
    jest.spyOn(pricingService, 'refresh').mockRejectedValue(new Error('nope'));
    setBalances({});
    const { UNSAFE_getByType } = renderScreen();
    await act(async () => {
      fireEvent(UNSAFE_getByType(RefreshControl), 'refresh');
    });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('renders linked-wallet cards (known + unknown, long + short, custom name) and navigates', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser.mockResolvedValue({
      addresses: [WALLET_LONG, WALLET_SHORT, WALLET_ACTIVE],
      activeAddress: WALLET_ACTIVE,
    });
    mockGetName.mockImplementation((addr: string) =>
      addr === LONG_ADDR ? 'Office cold' : null,
    );
    mockDiscovery.set(LONG_ADDR.toLowerCase(), {
      address: LONG_ADDR.toLowerCase(),
      assets: [],
      totalFiat: 42.5,
      known: true,
    });
    mockDiscovery.set(SHORT_ADDR.toLowerCase(), {
      address: SHORT_ADDR.toLowerCase(),
      assets: [],
      totalFiat: 1,
      known: false,
    });
    setBalances({ [USDT_ETH_ID]: '1000000' });

    const { getByTestId, getByText } = renderScreen();
    await waitFor(() => expect(getByTestId(`portfolio-linked-wallet-${LONG_ADDR.slice(0, 8)}`)).toBeTruthy());
    expect(getByTestId(`portfolio-linked-wallet-${SHORT_ADDR.slice(0, 8)}`)).toBeTruthy();
    expect(getByText('Office cold')).toBeTruthy();
    expect(getByText('—')).toBeTruthy();

    fireEvent.press(getByTestId(`portfolio-linked-wallet-${LONG_ADDR.slice(0, 8)}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/linked-wallet/[address]',
      params: { address: LONG_ADDR },
    });
  });

  it('drops unselected linked wallets and clears them when getUser fails', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockIsSelected.mockReturnValue(false);
    mockGetUser.mockRejectedValue(new Error('401'));
    const { queryByTestId } = renderScreen();
    await waitFor(() => expect(mockGetUser).toHaveBeenCalled());
    expect(queryByTestId(`portfolio-linked-wallet-${LONG_ADDR.slice(0, 8)}`)).toBeNull();
  });

  it('does not apply a late getUser result after unmount', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    let resolveUser: (value: unknown) => void = () => undefined;
    mockGetUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUser = resolve;
      }),
    );
    const { unmount } = renderScreen();
    unmount();
    await act(async () => {
      resolveUser({ addresses: [WALLET_LONG], activeAddress: null });
    });
  });

  it('does not apply a late getUser rejection after unmount', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    let rejectUser: (reason?: unknown) => void = () => undefined;
    mockGetUser.mockReturnValue(
      new Promise((_, reject) => {
        rejectUser = reject;
      }),
    );
    const { unmount } = renderScreen();
    unmount();
    await act(async () => {
      rejectUser(new Error('late'));
    });
  });

  it('swallows getUser failure during pull-to-refresh', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser
      .mockResolvedValueOnce({ addresses: [], activeAddress: null })
      .mockRejectedValueOnce(new Error('refresh failed'));
    setBalances({});
    const { UNSAFE_getByType } = renderScreen();
    await act(async () => {
      fireEvent(UNSAFE_getByType(RefreshControl), 'refresh');
    });
  });

  it('renders the dark backdrop when the theme is dark', () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId } = renderScreen();
    expect(getByTestId('portfolio-back-button')).toBeTruthy();
  });

  it('treats a missing addresses array as empty', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser.mockResolvedValue({ addresses: undefined, activeAddress: undefined });
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('portfolio-back-button')).toBeTruthy());
  });
});
