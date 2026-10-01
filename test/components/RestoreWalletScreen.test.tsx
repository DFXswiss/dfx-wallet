import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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
const mockWalletManager = {
  activeWalletId: null as string | null,
  deleteWallet: mockDeleteWallet,
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

function typeSeed(getByTestId: (id: string) => unknown, phrase: string) {
  fireEvent.changeText(
    getByTestId('restore-wallet-seed-input') as Parameters<typeof fireEvent.changeText>[0],
    phrase,
  );
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
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the continue CTA inert until a valid seed phrase is entered', async () => {
    const { getByTestId } = render(<RestoreWalletScreen />);
    typeSeed(getByTestId, 'not a real seed phrase');

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('tracks the entered word count', () => {
    const { getByTestId } = render(<RestoreWalletScreen />);
    typeSeed(getByTestId, 'alpha bravo charlie');
    expect(getByTestId('restore-wallet-word-count')).toBeTruthy();
  });

  it('restores from a valid seed and routes to setup-pin', async () => {
    const { getByTestId } = render(<RestoreWalletScreen />);
    typeSeed(getByTestId, VALID_SEED);

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

  it('confirms before replacing an existing wallet', async () => {
    mockWalletManager.activeWalletId = 'default';
    (Alert.alert as jest.Mock).mockImplementationOnce((_title, _message, buttons) => {
      (buttons as { onPress?: () => void }[])[1]?.onPress?.();
    });
    const { getByTestId } = render(<RestoreWalletScreen />);
    typeSeed(getByTestId, VALID_SEED);

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

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

  it('does not change either wallet when replacement is cancelled', async () => {
    mockAuthState.isOnboarded = true;
    (Alert.alert as jest.Mock).mockImplementationOnce((_title, _message, buttons) => {
      (buttons as { onPress?: () => void }[])[0]?.onPress?.();
    });
    const { getByTestId } = render(<RestoreWalletScreen />);
    typeSeed(getByTestId, VALID_SEED);

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
    const { getByTestId } = render(<RestoreWalletScreen />);
    typeSeed(getByTestId, VALID_SEED);

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
