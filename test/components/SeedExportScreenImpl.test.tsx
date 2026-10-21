import React from 'react';
import { Alert, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { secureStorage, StorageKeys } from '@/services/storage';
import {
  authenticatePasskey,
  deriveMnemonicFromPrf,
  PasskeyPrfUnsupportedError,
} from '@/features/passkey/services';

const mockPrevent = jest.fn(async (_key?: string) => undefined);
const mockAllow = jest.fn(async (_key?: string) => undefined);
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: (key?: string) => mockPrevent(key),
  allowScreenCaptureAsync: (key?: string) => mockAllow(key),
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
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
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
    getMnemonic.mockReset();
    getMnemonic.mockResolvedValue(TWELVE);
    (useWalletManager as jest.Mock).mockReturnValue({ getMnemonic });
    (secureStorage.get as jest.Mock).mockReset();
    (secureStorage.get as jest.Mock).mockResolvedValue(null);
    (authenticatePasskey as jest.Mock).mockReset();
    (deriveMnemonicFromPrf as jest.Mock).mockReset();
    (deriveMnemonicFromPrf as jest.Mock).mockReturnValue(TWELVE);
    jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
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
      await waitFor(() => expect(getAllByText('abandon').length).toBeGreaterThan(0));
      expect(mockPrevent).toHaveBeenCalledWith('seed-export');
      expect(Haptics.impactAsync).toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(getByText('common.copy'));
      });
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(TWELVE);
      expect(scheduled).toBeDefined();
      await act(async () => {
        scheduled!();
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }
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
    expect(deriveMnemonicFromPrf).toHaveBeenCalledWith(expect.any(Uint8Array), 2);
  });

  it('defaults the passkey derivation version to 1 when none is stored', async () => {
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'passkey' : null,
    );
    (authenticatePasskey as jest.Mock).mockResolvedValue({ prfOutput: new Uint8Array([1]) });
    const { getByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });
    await waitFor(() => expect(deriveMnemonicFromPrf).toHaveBeenCalledWith(expect.any(Uint8Array), 1));
  });

  it('shows the iOS PRF-unsupported copy', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'passkey' : null,
    );
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
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'passkey' : null,
    );
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
    (secureStorage.get as jest.Mock).mockImplementation(async (key: string) =>
      key === StorageKeys.WALLET_ORIGIN ? 'passkey' : null,
    );
    (authenticatePasskey as jest.Mock).mockRejectedValue(new Error('cancelled'));
    const { getByText } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealPasskey')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealPasskey'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'seedExport.deriveFailed');
  });

  it('releases screen-capture protection on unmount after the seed is shown', async () => {
    const { getByText, unmount } = render(<SeedExportScreenImpl />);
    await waitFor(() => expect(getByText('seedExport.revealSeed')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('seedExport.revealSeed'));
    });
    await waitFor(() => expect(mockPrevent).toHaveBeenCalled());
    unmount();
    expect(mockAllow).toHaveBeenCalledWith('seed-export');
  });
});
