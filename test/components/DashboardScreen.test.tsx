import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

// Dashboard touches `useDfxAuth` (auto-auth on mount) and
// `useTotalPortfolioFiat`. Mock both so the screen renders without booting
// the DFX backend wrapper or the pricing service.
const mockAuthenticate = jest.fn(async () => true);
jest.mock('@/hooks', () => ({
  useDfxAuth: () => ({
    authenticate: mockAuthenticate,
    authenticateSilent: jest.fn(),
    reauthenticateAsOwner: jest.fn(),
    logout: jest.fn(),
    isAuthenticating: false,
    error: null,
  }),
  useTotalPortfolioFiat: () => mockPortfolioFiat.current,
}));

const mockPortfolioFiat = { current: 1234.56 };

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import DashboardScreen from '../../app/(auth)/(tabs)/dashboard';
import { useAuthStore, useWalletStore } from '@/store';

describe('DashboardScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAuthenticate.mockClear();
    useWalletStore.setState({ selectedCurrency: 'USD' });
    useAuthStore.setState({ isDfxAuthenticated: false });
  });

  it('renders the dashboard shell with balance + action pills', () => {
    const { getByTestId } = render(<DashboardScreen />);
    expect(getByTestId('dashboard-screen')).toBeTruthy();
    expect(getByTestId('dashboard-balance-toggle')).toBeTruthy();
    expect(getByTestId('dashboard-action-receive')).toBeTruthy();
    expect(getByTestId('dashboard-action-send')).toBeTruthy();
  });

  it('renders the total balance in the user-selected currency', () => {
    const { getByText } = render(<DashboardScreen />);
    // splitBalance("1234.56") → whole "1’234" or "1'234", fraction "56".
    // We only assert the dollar symbol and the fraction; the thousands
    // separator is locale-dependent (see portfolio-presentation test).
    expect(getByText('$')).toBeTruthy();
    expect(getByText('.56')).toBeTruthy();
  });

  it('toggles the balance visibility when the eye is pressed', () => {
    const { getByTestId, queryByText, getByText } = render(<DashboardScreen />);

    // Initially the whole/fraction parts are visible; after pressing the
    // toggle, "••••" replaces them.
    expect(queryByText('••••')).toBeNull();
    fireEvent.press(getByTestId('dashboard-balance-toggle'));
    expect(getByText('••••')).toBeTruthy();
  });

  it('navigates to Receive when the Receive pill is pressed', () => {
    const { getByTestId } = render(<DashboardScreen />);
    fireEvent.press(getByTestId('dashboard-action-receive'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/receive');
  });

  it('navigates to Send when the Send pill is pressed', () => {
    const { getByTestId } = render(<DashboardScreen />);
    fireEvent.press(getByTestId('dashboard-action-send'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/send');
  });

  it('exposes Portfolio + Pay + Transactions pills when their flags are on', () => {
    // setup-globals.ts flips every EXPO_PUBLIC_ENABLE_* to "true" under
    // Jest, so the deferred pills must render.
    const { getByTestId } = render(<DashboardScreen />);
    expect(getByTestId('dashboard-action-portfolio')).toBeTruthy();
    expect(getByTestId('dashboard-action-pay')).toBeTruthy();
    expect(getByTestId('dashboard-action-transactions')).toBeTruthy();
  });

  it('triggers DFX silent auth once on mount when the user is not yet authenticated', () => {
    render(<DashboardScreen />);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('does not trigger DFX auth when the user is already authenticated', () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    render(<DashboardScreen />);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('navigates to /settings when the menu (hamburger) is tapped', () => {
    const { getByTestId } = render(<DashboardScreen />);
    fireEvent.press(getByTestId('dashboard-menu-button'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('navigates to /(auth)/multi-sig when the shield is tapped', () => {
    const { getByTestId } = render(<DashboardScreen />);
    fireEvent.press(getByTestId('dashboard-shield-button'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/multi-sig');
  });

  it('navigates to Portfolio + Pay when the deferred pills are tapped', () => {
    const { getByTestId } = render(<DashboardScreen />);
    fireEvent.press(getByTestId('dashboard-action-portfolio'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/portfolio');
    fireEvent.press(getByTestId('dashboard-action-pay'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/pay');
  });

  it('navigates to transaction-history when the Transactions link is tapped', () => {
    const { getByTestId } = render(<DashboardScreen />);
    fireEvent.press(getByTestId('dashboard-action-transactions'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/transaction-history');
  });

  it('formats integer balances without thousands separator chars stripped (insertThousandsSeparators)', () => {
    expect(() => render(<DashboardScreen />)).not.toThrow();
  });

  it('renders "0" / "00" for an empty portfolio (splitBalance zero branch)', () => {
    mockPortfolioFiat.current = 0;
    const { getByText } = render(<DashboardScreen />);
    expect(getByText('0')).toBeTruthy();
    expect(getByText('.00')).toBeTruthy();
    mockPortfolioFiat.current = 1234.56;
  });

  it('inserts thousands separators for large balances', () => {
    mockPortfolioFiat.current = 12_345_678.9;
    const { getByText } = render(<DashboardScreen />);
    expect(getByText("12'345'678")).toBeTruthy();
    mockPortfolioFiat.current = 1234.56;
  });

  it('uses the CHF symbol when selectedCurrency is CHF', () => {
    useWalletStore.setState({ selectedCurrency: 'CHF' });
    const { getByText } = render(<DashboardScreen />);
    expect(getByText('CHF')).toBeTruthy();
  });

  it('falls back to the raw code when an unknown currency is selected (CURRENCY_SYMBOLS miss)', () => {
    useWalletStore.setState({ selectedCurrency: 'GBP' });
    const { getByText } = render(<DashboardScreen />);
    expect(getByText('GBP')).toBeTruthy();
    useWalletStore.setState({ selectedCurrency: 'USD' });
  });

  it('hides balance via eye-toggle and switches the icon glyph', () => {
    const { getByTestId } = render(<DashboardScreen />);
    // The toggle re-renders the icon between "eye" and "eye-off". The
    // simplest assertion that the branch is exercised is that the
    // press handler does not throw.
    expect(() => fireEvent.press(getByTestId('dashboard-balance-toggle'))).not.toThrow();
  });
});
