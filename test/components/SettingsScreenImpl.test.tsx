import React from 'react';
import { Alert, Switch } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useThemeStore } from '@/theme';
import { useAuthStore, useWalletStore } from '@/store';
import { isBiometricAvailable } from '@/features/biometric/biometric';
import { dfxUserService } from '@/features/dfx-backend/services';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useWalletManager } from '@tetherto/wdk-react-native-core';

jest.mock('react-i18next', () => {
  const i18n = { language: 'en', changeLanguage: jest.fn(async () => undefined) };
  return {
    useTranslation: () => ({
      t: (key: string | string[], params?: Record<string, unknown>) => {
        const resolved = Array.isArray(key) ? key[0]! : key;
        return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
      },
      i18n,
    }),
    __i18n: i18n,
  };
});

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack(),
  }),
  Stack: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
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

jest.mock('@/features/biometric/biometric', () => ({
  isBiometricAvailable: jest.fn(),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxUserService: {
    updateUser: jest.fn(),
  },
}));

jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    secureStorage: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  };
});

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const actual = jest.requireActual('@/components');
  return {
    ...actual,
    Icon: ({ name }: { name: string }) => ReactActual.createElement(Text, null, name),
    DarkBackdrop: () => ReactActual.createElement(View, { testID: 'dark-backdrop' }),
  };
});

// eslint-disable-next-line import/first
import SettingsScreenImpl from '../../src/features/settings/SettingsScreenImpl';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __i18n } = require('react-i18next') as { __i18n: { language: string; changeLanguage: jest.Mock } };

function renderScreen() {
  return render(
    <ThemeProvider>
      <SettingsScreenImpl />
    </ThemeProvider>,
  );
}

function pressConfirm(alertSpy: jest.SpyInstance) {
  const buttons = alertSpy.mock.calls[0]![2] as { onPress?: () => void | Promise<void> }[];
  return buttons.find((b) => b.onPress)?.onPress?.();
}

describe('SettingsScreenImpl', () => {
  const deleteWallet = jest.fn();

  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    __i18n.language = 'en';
    __i18n.changeLanguage.mockReset();
    __i18n.changeLanguage.mockResolvedValue(undefined);
    (isBiometricAvailable as jest.Mock).mockReset();
    (isBiometricAvailable as jest.Mock).mockResolvedValue(true);
    (dfxUserService.updateUser as jest.Mock).mockReset();
    (dfxUserService.updateUser as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.get as jest.Mock).mockReset();
    (secureStorage.get as jest.Mock).mockResolvedValue(null);
    (secureStorage.set as jest.Mock).mockResolvedValue(undefined);
    deleteWallet.mockReset();
    deleteWallet.mockResolvedValue(undefined);
    (useWalletManager as jest.Mock).mockReturnValue({ deleteWallet });
    useAuthStore.setState({
      isDfxAuthenticated: false,
      biometricEnabled: false,
    });
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'CHF' });
    useThemeStore.setState({ mode: 'light' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the settings sections and navigates a route row', async () => {
    const { getByTestId, getByText } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-user-data')).toBeTruthy());
    expect(getByText('settings.title')).toBeTruthy();
    fireEvent.press(getByTestId('settings-user-data'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/kyc');
  });

  it('navigates every remaining route row', async () => {
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-email')).toBeTruthy());
    const routes: [string, string][] = [
      ['settings-email', '/(auth)/email'],
      ['settings-dfx-wallets', '/(auth)/wallets'],
      ['settings-seed', '/(auth)/seed-export'],
      ['settings-hardware-wallet', '/(auth)/hardware-connect'],
      ['settings-multi-sig', '/(auth)/multi-sig'],
      ['settings-network', '/(auth)/portfolio/manage'],
      ['settings-tax-report', '/(auth)/tax-report'],
      ['settings-legal-documents', '/(auth)/legal'],
      ['settings-contact', '/(auth)/contact'],
      ['settings-support', '/(auth)/support'],
    ];
    for (const [id, route] of routes) {
      fireEvent.press(getByTestId(id));
      expect(mockPush).toHaveBeenCalledWith(route);
    }
  });

  it('cycles language, currency and appearance', async () => {
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-language')).toBeTruthy());

    fireEvent.press(getByTestId('settings-language'));
    expect(__i18n.changeLanguage).toHaveBeenCalledWith('de');

    fireEvent.press(getByTestId('settings-currencies'));
    expect(useWalletStore.getState().selectedCurrency).toBe('EUR');
    fireEvent.press(getByTestId('settings-currencies'));
    expect(useWalletStore.getState().selectedCurrency).toBe('USD');
    fireEvent.press(getByTestId('settings-currencies'));
    expect(useWalletStore.getState().selectedCurrency).toBe('CHF');

    fireEvent.press(getByTestId('settings-appearance'));
    await waitFor(() => expect(useThemeStore.getState().mode).toBe('dark'));
    fireEvent.press(getByTestId('settings-appearance'));
    await waitFor(() => expect(useThemeStore.getState().mode).toBe('light'));
  });

  it('syncs language + currency to DFX when authenticated and swallows update failures', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    (dfxUserService.updateUser as jest.Mock).mockRejectedValue(new Error('offline'));
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-language')).toBeTruthy());
    fireEvent.press(getByTestId('settings-language'));
    fireEvent.press(getByTestId('settings-currencies'));
    await waitFor(() => expect(dfxUserService.updateUser).toHaveBeenCalled());
  });

  it('does not call DFX when flipping language/currency while logged out', async () => {
    useAuthStore.setState({ isDfxAuthenticated: false });
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-language')).toBeTruthy());
    fireEvent.press(getByTestId('settings-language'));
    fireEvent.press(getByTestId('settings-currencies'));
    expect(dfxUserService.updateUser).not.toHaveBeenCalled();
  });

  it('toggles DE → EN when the current language already starts with de', async () => {
    __i18n.language = 'de-CH';
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-language')).toBeTruthy());
    fireEvent.press(getByTestId('settings-language'));
    expect(__i18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('alerts and still persists when enabling biometrics without hardware', async () => {
    (isBiometricAvailable as jest.Mock).mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(isBiometricAvailable).toHaveBeenCalled());
    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    });
    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => expect(useAuthStore.getState().biometricEnabled).toBe(true));
  });

  it('toggles biometrics on without an alert when hardware is available', async () => {
    (isBiometricAvailable as jest.Mock).mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(isBiometricAvailable).toHaveBeenCalled());
    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    });
    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(useAuthStore.getState().biometricEnabled).toBe(true));
  });

  it('treats a biometric-availability rejection as unsupported', async () => {
    (isBiometricAvailable as jest.Mock).mockRejectedValue(new Error('no hardware'));
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-biometric')).toBeTruthy());
  });

  it('does not apply a late biometric probe after unmount', async () => {
    let resolveAvail: (value: boolean) => void = () => undefined;
    (isBiometricAvailable as jest.Mock).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveAvail = resolve;
      }),
    );
    const { unmount } = renderScreen();
    unmount();
    await act(async () => {
      resolveAvail(true);
    });
  });

  it('does not apply a late biometric rejection after unmount', async () => {
    let rejectAvail: (reason?: unknown) => void = () => undefined;
    (isBiometricAvailable as jest.Mock).mockReturnValue(
      new Promise<boolean>((_, reject) => {
        rejectAvail = reject;
      }),
    );
    const { unmount } = renderScreen();
    unmount();
    await act(async () => {
      rejectAvail(new Error('late'));
    });
  });

  it('deletes a seed wallet, resets auth and replaces the root route', async () => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'seed' : null,
    );
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-delete-wallet')).toBeTruthy());
    fireEvent.press(getByTestId('settings-delete-wallet'));
    await act(async () => {
      await pressConfirm(alertSpy);
    });
    expect(deleteWallet).toHaveBeenCalledWith('default');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('uses the passkey confirm copy and still resets when deleteWallet throws', async () => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'passkey' : null,
    );
    deleteWallet.mockRejectedValue(new Error('missing'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-delete-wallet')).toBeTruthy());
    fireEvent.press(getByTestId('settings-delete-wallet'));
    expect(alertSpy.mock.calls[0]![1]).toBe('settings.deleteWalletConfirmPasskey');
    await act(async () => {
      await pressConfirm(alertSpy);
    });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('goes back when history exists and replaces the dashboard otherwise', async () => {
    const { getByText, unmount } = renderScreen();
    await waitFor(() => expect(getByText('settings.title')).toBeTruthy());
    // The back button is the first pressable in the header (no testID).
    fireEvent.press(getByText('arrow-left'));
    expect(mockBack).toHaveBeenCalled();
    unmount();

    mockCanGoBack.mockReturnValue(false);
    const again = renderScreen();
    await waitFor(() => expect(again.getByText('settings.title')).toBeTruthy());
    fireEvent.press(again.getByText('arrow-left'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });

  it('renders the dark backdrop when the theme is dark', async () => {
    useThemeStore.setState({ mode: 'dark' });
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('dark-backdrop')).toBeTruthy());
  });

  it('cycles an unknown stored currency back onto the CHF/EUR/USD ring', async () => {
    useWalletStore.setState({ selectedCurrency: 'GBP' });
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-currencies')).toBeTruthy());
    fireEvent.press(getByTestId('settings-currencies'));
    expect(useWalletStore.getState().selectedCurrency).toBe('CHF');
  });
});
