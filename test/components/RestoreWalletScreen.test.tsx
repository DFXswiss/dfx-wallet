import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';

const mockPreventScreenCapture = jest.fn<Promise<void>, [string?]>();
const mockAllowScreenCapture = jest.fn<Promise<void>, [string?]>();
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: (key?: string) => mockPreventScreenCapture(key),
  allowScreenCaptureAsync: (key?: string) => mockAllowScreenCapture(key),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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
}));

const mockRestoreWallet = jest.fn();
const mockDeleteWallet = jest.fn();
const mockGetEncryptedEntropy = jest.fn();
const mockGetEncryptedSeed = jest.fn();
const mockGetEncryptionKey = jest.fn();
const mockWalletManager = {
  activeWalletId: null as string | null,
  deleteWallet: mockDeleteWallet,
  getEncryptedEntropy: mockGetEncryptedEntropy,
  getEncryptedSeed: mockGetEncryptedSeed,
  getEncryptionKey: mockGetEncryptionKey,
  restoreWallet: mockRestoreWallet,
};
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => mockWalletManager,
}));

const mockResetAuth = jest.fn();
const mockAuthState = { isOnboarded: false };
jest.mock('@/store', () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
    { getState: () => ({ reset: mockResetAuth }) },
  ),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

import RestoreWalletScreen from '../../src/features/restore/RestoreWalletScreenImpl';

// A valid 12-word BIP-39 mnemonic (the canonical all-zero-entropy vector).
const VALID_SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function typeSeed(findByTestId: ReturnType<typeof render>['findByTestId'], phrase: string) {
  fireEvent.changeText(await findByTestId('restore-wallet-seed-input'), phrase);
}

describe('RestoreWalletScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
    mockWalletManager.activeWalletId = null;
    mockAuthState.isOnboarded = false;
    mockResetAuth.mockResolvedValue(undefined);
    mockRestoreWallet.mockResolvedValue('default');
    mockDeleteWallet.mockResolvedValue(undefined);
    mockGetEncryptedEntropy.mockResolvedValue(null);
    mockGetEncryptedSeed.mockResolvedValue(null);
    mockGetEncryptionKey.mockResolvedValue(null);
    mockPreventScreenCapture.mockReset();
    mockAllowScreenCapture.mockReset();
    mockPreventScreenCapture.mockResolvedValue(undefined);
    mockAllowScreenCapture.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Red mutation: remove the protection hook call; native protection is never requested.
  it('activates mnemonic screen-capture protection on mount', async () => {
    render(<RestoreWalletScreen />);

    await waitFor(() =>
      expect(mockPreventScreenCapture).toHaveBeenCalledWith('restore-wallet-mnemonic'),
    );
  });

  // Red mutation: disable the hook cleanup; native protection is not released on unmount.
  it('releases mnemonic screen-capture protection on unmount', async () => {
    const view = render(<RestoreWalletScreen />);
    await waitFor(() => expect(mockPreventScreenCapture).toHaveBeenCalled());

    view.unmount();

    await waitFor(() =>
      expect(mockAllowScreenCapture).toHaveBeenCalledWith('restore-wallet-mnemonic'),
    );
  });

  // Red mutation: render the mnemonic input while protection is pending.
  it('keeps mnemonic input hidden until screen-capture protection settles', async () => {
    let resolveProtection: (() => void) | undefined;
    mockPreventScreenCapture.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveProtection = resolve;
        }),
    );
    const view = render(<RestoreWalletScreen />);

    expect(view.getByTestId('restore-wallet-protection-loading')).toBeTruthy();
    expect(view.queryByTestId('restore-wallet-seed-input')).toBeNull();
    await waitFor(() => expect(mockPreventScreenCapture).toHaveBeenCalled());

    await act(async () => {
      resolveProtection!();
    });

    expect(await view.findByTestId('restore-wallet-seed-input')).toBeTruthy();
    expect(view.queryByTestId('restore-wallet-protection-loading')).toBeNull();
  });

  // Red mutations: gate the input to active only; remove the unavailable-state warning.
  it('shows the mnemonic input and warning when screen-capture protection is unavailable', async () => {
    mockPreventScreenCapture.mockRejectedValueOnce(new Error('native failure'));
    const { findByTestId, findByText } = render(<RestoreWalletScreen />);

    expect(await findByTestId('restore-wallet-seed-input')).toBeTruthy();
    expect(await findByText('common.screenCaptureUnavailable')).toBeTruthy();
  });

  it('keeps the continue CTA inert until a valid seed phrase is entered', async () => {
    const { findByTestId, getByTestId } = render(<RestoreWalletScreen />);
    await typeSeed(findByTestId, 'not a real seed phrase');

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('tracks the entered word count', async () => {
    const { findByTestId, getByTestId } = render(<RestoreWalletScreen />);
    await typeSeed(findByTestId, 'alpha bravo charlie');
    expect(getByTestId('restore-wallet-word-count')).toBeTruthy();
  });

  it('restores from a valid seed and routes to setup-pin', async () => {
    const { findByTestId, getByTestId } = render(<RestoreWalletScreen />);
    await typeSeed(findByTestId, VALID_SEED);

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(mockRestoreWallet).toHaveBeenCalledTimes(1);
    expect(mockRestoreWallet).toHaveBeenCalledWith(expect.anything(), 'default');
    expect(mockResetAuth).toHaveBeenCalledTimes(1);
    expect(mockDeleteWallet).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/setup-pin');
  });

  it('warns that replacement deletes the current wallet before importing the new one', async () => {
    mockWalletManager.activeWalletId = 'default';
    (Alert.alert as jest.Mock).mockImplementationOnce((_title, _message, buttons) => {
      (buttons as { onPress?: () => void }[])[1]?.onPress?.();
    });
    const { findByTestId, getByTestId } = render(<RestoreWalletScreen />);
    await typeSeed(findByTestId, VALID_SEED);

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(en.onboarding.restoreConfirmMessage).toBe(
      'Your current wallet will be removed before the new wallet is imported. It can only be recovered with its own seed phrase.',
    );
    expect(de.onboarding.restoreConfirmMessage).toBe(
      'Deine aktuelle Wallet wird entfernt, bevor die neue Wallet importiert wird. Sie kann nur mit ihrer eigenen Seed Phrase wiederhergestellt werden.',
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'onboarding.restoreConfirmTitle',
      'onboarding.restoreConfirmMessage',
      [
        expect.objectContaining({ text: 'common.cancel', style: 'cancel' }),
        expect.objectContaining({
          text: 'onboarding.restoreConfirmAction',
          style: 'destructive',
        }),
      ],
      expect.objectContaining({ cancelable: true }),
    );
    expect(mockResetAuth).toHaveBeenCalledTimes(1);
    expect(mockDeleteWallet).toHaveBeenCalledWith('default');
    expect(mockRestoreWallet).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/setup-pin');
  });

  // Red mutations: omit the retry, skip reset after partial deletion, or omit a WDK item getter.
  it('resets and stays on restore when deleting the current wallet is partial', async () => {
    mockWalletManager.activeWalletId = 'default';
    mockDeleteWallet.mockRejectedValue(new Error('partial delete'));
    mockGetEncryptionKey.mockResolvedValue('encryption-key');
    mockGetEncryptedSeed.mockResolvedValue(null);
    mockGetEncryptedEntropy.mockResolvedValue('encrypted-entropy');
    (Alert.alert as jest.Mock).mockImplementationOnce((_title, _message, buttons) => {
      (buttons as { onPress?: () => void }[])[1]?.onPress?.();
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { findByTestId, getByTestId } = render(<RestoreWalletScreen />);
    await typeSeed(findByTestId, VALID_SEED);

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(mockDeleteWallet).toHaveBeenCalledTimes(2);
    expect(mockGetEncryptionKey).toHaveBeenCalledWith('default');
    expect(mockGetEncryptedSeed).toHaveBeenCalledWith('default');
    expect(mockGetEncryptedEntropy).toHaveBeenCalledWith('default');
    expect(mockResetAuth).toHaveBeenCalledTimes(1);
    expect(mockRestoreWallet).not.toHaveBeenCalled();
    expect(getByTestId('restore-wallet-error')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not change either wallet when replacement is cancelled', async () => {
    mockAuthState.isOnboarded = true;
    (Alert.alert as jest.Mock).mockImplementationOnce((_title, _message, buttons) => {
      (buttons as { onPress?: () => void }[])[0]?.onPress?.();
    });
    const { findByTestId, getByTestId } = render(<RestoreWalletScreen />);
    await typeSeed(findByTestId, VALID_SEED);

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(mockResetAuth).not.toHaveBeenCalled();
    expect(mockDeleteWallet).not.toHaveBeenCalled();
    expect(mockRestoreWallet).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('surfaces an error and stays on the screen when restore fails for an unrelated reason', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockRestoreWallet.mockRejectedValueOnce(new Error('WDK worklet timeout'));
    const { findByTestId, getByTestId } = render(<RestoreWalletScreen />);
    await typeSeed(findByTestId, VALID_SEED);

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(getByTestId('restore-wallet-error')).toBeTruthy();
    expect(mockResetAuth).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('falls back to welcome when going back with no history', () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByTestId } = render(<RestoreWalletScreen />);
    // The AppHeader back control is wired to router.back / replace fallback.
    fireEvent.press(getByTestId('restore-wallet-back'));
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/welcome');
  });
});
