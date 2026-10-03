import React from 'react';
import { Alert, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { secureStorage, StorageKeys } from '@/services/storage';
import {
  authenticatePasskey,
  deriveMnemonicFromPrf,
  PasskeyPrfUnsupportedError,
} from '@/features/passkey/services';
import { copySensitive } from '@/services/clipboard';

const mockPrevent = jest.fn<Promise<void>, [string?]>();
const mockAllow = jest.fn<Promise<void>, [string?]>();
const mockRequestReauth = jest.fn(async () => true);
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: (key?: string) => mockPrevent(key),
  allowScreenCaptureAsync: (key?: string) => mockAllow(key),
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('@/services/clipboard', () => ({ copySensitive: jest.fn() }));

jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    secureStorage: {
      get: jest.fn(),
    },
  };
});

jest.mock('@/features/passkey/services', () => {
  class PasskeyPrfUnsupportedErrorMock extends Error {
    constructor() {
      super('PRF extension not supported by this authenticator');
      this.name = 'PasskeyPrfUnsupportedError';
    }
  }
  return {
    authenticatePasskey: jest.fn(),
    deriveMnemonicFromPrf: jest.fn(),
    PasskeyPrfUnsupportedError: PasskeyPrfUnsupportedErrorMock,
  };
});

const TWELVE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function mockPasskeyStorage(derivationVersion: string | null = '1') {
  (secureStorage.get as jest.Mock).mockImplementation(async (key: string) => {
    if (key === StorageKeys.WALLET_ORIGIN) return 'passkey';
    if (key === StorageKeys.PASSKEY_CREDENTIAL_ID) return 'stored-credential';
    if (key === StorageKeys.PASSKEY_DERIVATION_VERSION) return derivationVersion;
    return null;
  });
}

// eslint-disable-next-line import/first
import SeedExportScreenImpl from '../../src/features/settings/SeedExportScreenImpl';

describe('SeedExportScreenImpl', () => {
  const getMnemonic = jest.fn();

  beforeEach(() => {
    mockBack.mockReset();
    mockPrevent.mockReset();
    mockAllow.mockReset();
    mockPrevent.mockResolvedValue(undefined);
    mockAllow.mockResolvedValue(undefined);
    mockRequestReauth.mockReset();
    mockRequestReauth.mockResolvedValue(true);
    getMnemonic.mockReset();
    getMnemonic.mockResolvedValue(TWELVE);
    (useWalletManager as jest.Mock).mockReturnValue({ getMnemonic });
    (secureStorage.get as jest.Mock).mockReset();
    (secureStorage.get as jest.Mock).mockResolvedValue(null);
    (authenticatePasskey as jest.Mock).mockReset();
    (deriveMnemonicFromPrf as jest.Mock).mockReset();
    (deriveMnemonicFromPrf as jest.Mock).mockReturnValue(TWELVE);
    (copySensitive as jest.Mock).mockReset();
    (copySensitive as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the seed-flow shell and goes back', async () => {
    const { getByTestId, getByText } = render(<SeedExportScreenImpl />);
    expect(getByTestId('seed-export-screen')).toBeTruthy();
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
    fireEvent.press(getByTestId('seed-export-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('disables reveal while wallet origin metadata is loading', () => {
    (secureStorage.get as jest.Mock).mockImplementation(
      () => new Promise<string | null>(() => undefined),
    );
    const { getByTestId } = render(<SeedExportScreenImpl />);
    const revealButton = getByTestId('seed-export-reveal-button');

    expect(revealButton.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(revealButton);
    expect(mockRequestReauth).not.toHaveBeenCalled();
  });

  it('fails closed when the initial wallet origin metadata read rejects', async () => {
    (secureStorage.get as jest.Mock).mockRejectedValue(new Error('keychain unavailable'));
    const { getByTestId, getByText } = render(<SeedExportScreenImpl />);

    await waitFor(() => expect(getByText('common.error')).toBeTruthy());
    const revealButton = getByTestId('seed-export-reveal-button');
    expect(revealButton.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(revealButton);
    expect(mockRequestReauth).not.toHaveBeenCalled();
    expect(getMnemonic).not.toHaveBeenCalled();
  });

  it('reveals a seed-flow mnemonic from WDK and copies it', async () => {
    let scheduled: (() => void) | undefined;
    const realSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = jest
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: () => void, ms?: number, ...rest: unknown[]) => {
        if (ms === 2000) {
          scheduled = cb;
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }
        return realSetTimeout.call(globalThis, cb, ms, ...rest);
      }) as unknown as typeof setTimeout);

    try {
      const { getByText, getAllByText } = render(<SeedExportScreenImpl />);
      await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
      await act(async () => {
        fireEvent.press(getByText('seedExport.revealSeed'));
      });
      expect(mockRequestReauth).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(getAllByText('abandon').length).toBeGreaterThan(0));
      expect(mockPrevent).toHaveBeenCalledWith('seed-export');
      expect(Haptics.impactAsync).toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(getByText('common.copy'));
      });
      expect(copySensitive).toHaveBeenCalledWith(TWELVE);
      expect(scheduled).toBeDefined();
      await act(async () => {
        scheduled!();
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('does not read or reveal the seed when reauthentication is declined', async () => {
    mockRequestReauth.mockResolvedValueOnce(false);
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });

    expect(getMnemonic).not.toHaveBeenCalled();
    expect(queryAllByText('abandon')).toHaveLength(0);
  });

  it('aborts when passkey origin metadata disappears after reauthentication', async () => {
    let afterReauth = false;
    mockPasskeyStorage();
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) => {
      if (afterReauth) return null;
      if (key === StorageKeys.WALLET_ORIGIN) return 'passkey';
      if (key === StorageKeys.PASSKEY_CREDENTIAL_ID) return 'stored-credential';
      if (key === StorageKeys.PASSKEY_DERIVATION_VERSION) return '1';
      return null;
    });
    mockRequestReauth.mockImplementationOnce(async () => {
      afterReauth = true;
      return true;
    });
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'common.error',
      'seedExport.passkeyVerificationUnavailable',
    );
    expect(authenticatePasskey).not.toHaveBeenCalled();
    expect(getMnemonic).not.toHaveBeenCalled();
    expect(queryAllByText('abandon')).toHaveLength(0);
  });

  it('aborts when wallet origin metadata cannot be reread after reauthentication', async () => {
    let afterReauth = false;
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) => {
      if (afterReauth) throw new Error('keychain unavailable');
      if (key === StorageKeys.WALLET_ORIGIN) return 'passkey';
      if (key === StorageKeys.PASSKEY_CREDENTIAL_ID) return 'stored-credential';
      if (key === StorageKeys.PASSKEY_DERIVATION_VERSION) return '1';
      return null;
    });
    mockRequestReauth.mockImplementationOnce(async () => {
      afterReauth = true;
      return true;
    });
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'seedExport.deriveFailed');
    expect(authenticatePasskey).not.toHaveBeenCalled();
    expect(getMnemonic).not.toHaveBeenCalled();
    expect(queryAllByText('abandon')).toHaveLength(0);
  });

  it('falls back to the encrypted-seed store when getMnemonic is missing', async () => {
    (useWalletManager as jest.Mock).mockReturnValue({});
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.ENCRYPTED_SEED ? TWELVE : null,
    );
    const { getByText, getAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });
    await waitFor(() => expect(getAllByText('abandon').length).toBeGreaterThan(0));
  });

  it('falls back to the encrypted-seed store when getMnemonic returns null', async () => {
    getMnemonic.mockResolvedValue(null);
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.ENCRYPTED_SEED ? TWELVE : null,
    );
    const { getByText, getAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });
    await waitFor(() => expect(getAllByText('abandon').length).toBeGreaterThan(0));
  });

  it('alerts when neither WDK nor the encrypted-seed store has a mnemonic', async () => {
    getMnemonic.mockResolvedValue(null);
    (secureStorage.get as jest.Mock).mockResolvedValue(null);
    const { getByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'seedExport.deriveFailed');
  });

  it('alerts when getMnemonic throws', async () => {
    getMnemonic.mockRejectedValue(new Error('worklet down'));
    const { getByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });
    expect(Haptics.notificationAsync).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'seedExport.deriveFailed');
  });

  it('reveals a passkey-derived mnemonic using the stored derivation version', async () => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === StorageKeys.WALLET_ORIGIN) return 'passkey';
      if (key === StorageKeys.PASSKEY_CREDENTIAL_ID) return 'stored-credential';
      if (key === StorageKeys.PASSKEY_DERIVATION_VERSION) return '2';
      return null;
    });
    (authenticatePasskey as jest.Mock).mockResolvedValue({ prfOutput: new Uint8Array([1, 2, 3]) });
    const { getByText, getAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });
    await waitFor(() => expect(getAllByText('abandon').length).toBeGreaterThan(0));
    expect(authenticatePasskey).toHaveBeenCalledWith({ credentialId: 'stored-credential' });
    expect(deriveMnemonicFromPrf).toHaveBeenCalledWith(expect.any(Uint8Array), 2);
    expect(getMnemonic).toHaveBeenCalledWith('default');
  });

  it('defaults the passkey derivation version to 1 when none is stored', async () => {
    mockPasskeyStorage(null);
    (authenticatePasskey as jest.Mock).mockResolvedValue({ prfOutput: new Uint8Array([1]) });
    const { getByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });
    await waitFor(() =>
      expect(deriveMnemonicFromPrf).toHaveBeenCalledWith(expect.any(Uint8Array), 1),
    );
    expect(authenticatePasskey).toHaveBeenCalledWith({ credentialId: 'stored-credential' });
  });

  it('does not reveal a passkey-derived mnemonic that differs from the WDK wallet', async () => {
    mockPasskeyStorage();
    (authenticatePasskey as jest.Mock).mockResolvedValue({ prfOutput: new Uint8Array([1]) });
    (deriveMnemonicFromPrf as jest.Mock).mockReturnValue('different derived mnemonic');
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'seedExport.seedMismatch');
    expect(queryAllByText('abandon')).toHaveLength(0);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error,
    );
  });

  it('does not reveal a passkey-derived mnemonic when WDK getMnemonic is unavailable', async () => {
    (useWalletManager as jest.Mock).mockReturnValue({});
    mockPasskeyStorage();
    (authenticatePasskey as jest.Mock).mockResolvedValue({ prfOutput: new Uint8Array([1]) });
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'common.error',
      'seedExport.passkeyVerificationUnavailable',
    );
    expect(queryAllByText('abandon')).toHaveLength(0);
    expect(authenticatePasskey).not.toHaveBeenCalled();
  });

  it('does not reveal a passkey-derived mnemonic when WDK has no mnemonic to compare', async () => {
    getMnemonic.mockResolvedValue(null);
    mockPasskeyStorage();
    (authenticatePasskey as jest.Mock).mockResolvedValue({ prfOutput: new Uint8Array([1]) });
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'common.error',
      'seedExport.passkeyVerificationUnavailable',
    );
    expect(queryAllByText('abandon')).toHaveLength(0);
    expect(getMnemonic).toHaveBeenCalledWith('default');
  });

  it('fails closed for an origin-only marker left by interrupted passkey setup', async () => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'passkey' : null,
    );
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'common.error',
      'seedExport.passkeyVerificationUnavailable',
    );
    expect(authenticatePasskey).not.toHaveBeenCalled();
    expect(deriveMnemonicFromPrf).not.toHaveBeenCalled();
    expect(getMnemonic).not.toHaveBeenCalled();
    expect(queryAllByText('abandon')).toHaveLength(0);
  });

  it.each([
    ['credential ID only', StorageKeys.PASSKEY_CREDENTIAL_ID, 'stored-credential'],
    ['derivation version only', StorageKeys.PASSKEY_DERIVATION_VERSION, '1'],
  ])('fails closed for partial passkey metadata: %s', async (_label, partialKey, value) => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === partialKey ? value : null,
    );
    const { getByText, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'common.error',
      'seedExport.passkeyVerificationUnavailable',
    );
    expect(authenticatePasskey).not.toHaveBeenCalled();
    expect(getMnemonic).not.toHaveBeenCalled();
    expect(queryAllByText('abandon')).toHaveLength(0);
  });

  it('shows the iOS PRF-unsupported copy', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockPasskeyStorage();
    (authenticatePasskey as jest.Mock).mockRejectedValue(new PasskeyPrfUnsupportedError());
    try {
      const { getByText } = render(<SeedExportScreenImpl />);
      await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());
      await act(async () => {
        fireEvent.press(getByText('seedExport.revealPasskey'));
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'common.error',
        expect.stringContaining('passkey.prfUnsupported'),
      );
      expect(String((Alert.alert as jest.Mock).mock.calls[0]![1])).toContain('iCloud Keychain');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  });

  it('shows the default (Google Password Manager) PRF-unsupported copy', async () => {
    const selectSpy = jest.spyOn(Platform, 'select').mockImplementation(
      (spec: { ios?: unknown; default?: unknown }) => spec.default ?? spec.ios,
    );
    mockPasskeyStorage();
    (authenticatePasskey as jest.Mock).mockRejectedValue(new PasskeyPrfUnsupportedError());
    try {
      const { getByText } = render(<SeedExportScreenImpl />);
      await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());
      await act(async () => {
        fireEvent.press(getByText('seedExport.revealPasskey'));
      });
      expect(String((Alert.alert as jest.Mock).mock.calls[0]![1])).toContain('Google Password Manager');
    } finally {
      selectSpy.mockRestore();
    }
  });

  it('alerts a generic derive-failed message for other passkey errors', async () => {
    mockPasskeyStorage();
    (authenticatePasskey as jest.Mock).mockRejectedValue(new Error('cancelled'));
    const { getByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'seedExport.deriveFailed');
  });

  it('keeps the seed hidden while screen-capture protection is pending', async () => {
    let resolveProtection: (() => void) | undefined;
    mockPrevent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveProtection = resolve;
        }),
    );
    const { getByText, getByTestId, queryAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });

    await waitFor(() => expect(mockPrevent).toHaveBeenCalledWith('seed-export'));
    expect(getByTestId('seed-export-protection-loading')).toBeTruthy();
    expect(queryAllByText('abandon')).toHaveLength(0);

    await act(async () => {
      resolveProtection!();
    });

    await waitFor(() => expect(queryAllByText('abandon').length).toBeGreaterThan(0));
  });

  it('shows a warning and the seed when screen-capture protection is unavailable', async () => {
    mockPrevent.mockRejectedValueOnce(new Error('native failure'));
    const { getByText, getAllByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });

    await waitFor(() => expect(getByText('common.screenCaptureUnavailable')).toBeTruthy());
    expect(getAllByText('abandon').length).toBeGreaterThan(0);
  });

  it('releases screen-capture protection on unmount after the seed is shown', async () => {
    const { getByText, unmount } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });
    await waitFor(() => expect(mockPrevent).toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(mockAllow).toHaveBeenCalledWith('seed-export'));
  });
});
