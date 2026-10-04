import React from 'react';
import { Alert, Switch } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import {
  authenticateWithBiometric,
  isBiometricAvailable,
} from '@/features/biometric/biometric';
import { dfxUserService } from '@/features/dfx-backend/services';
import { secureStorage, StorageKeys } from '@/services/storage';
import { useAuthStore, useWalletStore } from '@/store';
import { ThemeProvider, useThemeStore } from '@/theme';

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
const mockRequestReauth = jest.fn(async () => true);
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack(),
  }),
  Stack: { Screen: () => null },
}));

jest.mock('@/hooks/useReauthenticate', () => ({
  useReauthenticate: () => ({
    requestReauth: mockRequestReauth,
    modalProps: {
      visible: false,
      error: null,
      locked: false,
      verifying: false,
      onCancel: jest.fn(),
      onSubmit: jest.fn(),
    },
  }),
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
  authenticateWithBiometric: jest.fn(),
  isBiometricAvailable: jest.fn(),
}));

jest.mock('@/features/dfx-backend/services', () => ({
  dfxApi: {
    clearAuthToken: jest.fn(),
  },
  dfxAuthService: {
    adoptStoredToken: jest.fn(),
  },
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
  const getEncryptedEntropy = jest.fn();
  const getEncryptedSeed = jest.fn();
  const getEncryptionKey = jest.fn();

  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockRequestReauth.mockReset();
    mockRequestReauth.mockResolvedValue(true);
    __i18n.language = 'en';
    __i18n.changeLanguage.mockReset();
    __i18n.changeLanguage.mockResolvedValue(undefined);
    (isBiometricAvailable as jest.Mock).mockReset();
    (isBiometricAvailable as jest.Mock).mockResolvedValue(true);
    (authenticateWithBiometric as jest.Mock).mockReset();
    (authenticateWithBiometric as jest.Mock).mockResolvedValue(true);
    (dfxUserService.updateUser as jest.Mock).mockReset();
    (dfxUserService.updateUser as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.get as jest.Mock).mockReset();
    (secureStorage.get as jest.Mock).mockResolvedValue(null);
    (secureStorage.set as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.remove as jest.Mock).mockReset();
    (secureStorage.remove as jest.Mock).mockResolvedValue(undefined);
    deleteWallet.mockReset();
    deleteWallet.mockResolvedValue(undefined);
    getEncryptedEntropy.mockReset();
    getEncryptedEntropy.mockResolvedValue(null);
    getEncryptedSeed.mockReset();
    getEncryptedSeed.mockResolvedValue(null);
    getEncryptionKey.mockReset();
    getEncryptionKey.mockResolvedValue(null);
    (useWalletManager as jest.Mock).mockReturnValue({
      deleteWallet,
      getEncryptedEntropy,
      getEncryptedSeed,
      getEncryptionKey,
    });
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

  it('refuses to enable biometrics without available hardware', async () => {
    (isBiometricAvailable as jest.Mock).mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(isBiometricAvailable).toHaveBeenCalled());
    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    });
    expect(alertSpy).toHaveBeenCalled();
    expect(authenticateWithBiometric).not.toHaveBeenCalled();
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('enables biometrics only after a successful localized authentication prompt', async () => {
    (isBiometricAvailable as jest.Mock).mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(isBiometricAvailable).toHaveBeenCalled());
    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(authenticateWithBiometric).toHaveBeenCalledWith({
      promptMessage: 'biometric.enable',
      cancelLabel: 'biometric.usePin',
    });
    await waitFor(() => expect(useAuthStore.getState().biometricEnabled).toBe(true));
  });

  it('keeps biometrics disabled when the enrollment authentication is cancelled', async () => {
    (authenticateWithBiometric as jest.Mock).mockResolvedValue(false);
    const { UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(isBiometricAvailable).toHaveBeenCalled());

    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    });

    expect(authenticateWithBiometric).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('disables biometrics without prompting for authentication', async () => {
    useAuthStore.setState({ biometricEnabled: true });
    const { UNSAFE_getByType } = renderScreen();
    await waitFor(() => expect(isBiometricAvailable).toHaveBeenCalled());

    await act(async () => {
      fireEvent(UNSAFE_getByType(Switch), 'valueChange', false);
    });

    expect(authenticateWithBiometric).not.toHaveBeenCalled();
    await waitFor(() => expect(useAuthStore.getState().biometricEnabled).toBe(false));
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
    expect(mockRequestReauth).toHaveBeenCalledTimes(1);
    expect(deleteWallet).toHaveBeenCalledWith('default');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  // Red mutations: omit the retry or omit any WDK credential getter from dependency wiring.
  it('uses the passkey confirm copy and resets when a throwing delete removed the wallet', async () => {
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
    expect(deleteWallet).toHaveBeenCalledTimes(2);
    expect(getEncryptionKey).toHaveBeenCalledWith('default');
    expect(getEncryptedSeed).toHaveBeenCalledWith('default');
    expect(getEncryptedEntropy).toHaveBeenCalledWith('default');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  // Red mutation: exclude passkey-pending from isPasskeyOrigin.
  it('treats a pending passkey origin as passkey metadata', async () => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'passkey-pending' : null,
    );
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, getByText } = renderScreen();
    await waitFor(() => expect(getByText('settings.seed')).toBeTruthy());

    fireEvent.press(getByTestId('settings-delete-wallet'));

    expect(alertSpy.mock.calls[0]![1]).toBe('settings.deleteWalletConfirmPasskey');
  });

  it('leaves the authenticated screen and warns when cleanup is incomplete after deletion', async () => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.PIN_HASH ? 'hash' : null,
    );
    (secureStorage.remove as jest.Mock).mockImplementation(async (key: string) => {
      if (key === StorageKeys.PIN_HASH) throw new Error('keychain unavailable');
    });
    useAuthStore.setState({ isOnboarded: true, isAuthenticated: true, pinHash: 'hash' });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-delete-wallet')).toBeTruthy());
    fireEvent.press(getByTestId('settings-delete-wallet'));

    await act(async () => {
      await pressConfirm(alertSpy);
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(alertSpy).toHaveBeenLastCalledWith(
      'common.error',
      'settings.deleteWalletCleanupFailed',
    );
    expect(mockReplace.mock.invocationCallOrder[0]).toBeLessThan(
      alertSpy.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('does not delete when wallet reauthentication is declined', async () => {
    mockRequestReauth.mockResolvedValueOnce(false);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-delete-wallet')).toBeTruthy());
    fireEvent.press(getByTestId('settings-delete-wallet'));
    await act(async () => {
      await pressConfirm(alertSpy);
    });

    expect(deleteWallet).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalledWith('/');
  });

  // Red mutation: classify three remaining WDK credential items as a partial deletion.
  it('shows an error and keeps auth state when deletion fails and the wallet remains', async () => {
    const expectedAuthState = {
      isAuthenticated: true,
      isOnboarded: true,
      pinHash: 'distinctive-pin-hash',
    };
    useAuthStore.setState(expectedAuthState);
    deleteWallet.mockRejectedValue(new Error('delete failed'));
    getEncryptionKey.mockResolvedValue('encryption-key');
    getEncryptedSeed.mockResolvedValue('encrypted-seed');
    getEncryptedEntropy.mockResolvedValue('encrypted-entropy');
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('settings-delete-wallet')).toBeTruthy());
    fireEvent.press(getByTestId('settings-delete-wallet'));
    await act(async () => {
      await pressConfirm(alertSpy);
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/');
    expect(alertSpy).toHaveBeenLastCalledWith('common.error', 'settings.deleteWalletFailed');
    expect(useAuthStore.getState()).toMatchObject(expectedAuthState);
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
