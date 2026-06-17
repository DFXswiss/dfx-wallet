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
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({
    restoreWallet: mockRestoreWallet,
    deleteWallet: mockDeleteWallet,
  }),
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
    mockRestoreWallet.mockResolvedValue(undefined);
    mockDeleteWallet.mockResolvedValue(undefined);
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
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/setup-pin');
  });

  it('recovers from an "already exists" error by deleting and re-restoring', async () => {
    mockRestoreWallet
      .mockRejectedValueOnce(new Error('Wallet already exists for this identifier'))
      .mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<RestoreWalletScreen />);
    typeSeed(getByTestId, VALID_SEED);

    await act(async () => {
      fireEvent.press(getByTestId('restore-wallet-continue-button'));
    });

    expect(mockDeleteWallet).toHaveBeenCalledWith('default');
    expect(mockRestoreWallet).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/setup-pin');
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
