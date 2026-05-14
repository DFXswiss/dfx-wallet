import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

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

import CreateWalletScreen from '../../app/(onboarding)/create-wallet';

describe('CreateWalletScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockRestoreWallet.mockReset();
    mockRestoreWallet.mockResolvedValue(undefined);
    mockDeleteWallet.mockReset();
    mockDeleteWallet.mockResolvedValue(undefined);
    jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
  });

  it('renders the seed card with the reveal CTA hidden until tapped', () => {
    const { getByTestId, queryByTestId } = render(<CreateWalletScreen />);
    expect(getByTestId('create-wallet-screen')).toBeTruthy();
    expect(getByTestId('create-wallet-reveal-button')).toBeTruthy();
    expect(queryByTestId('create-wallet-seed-container')).toBeNull();
  });

  it('reveals 12 seed words after pressing the reveal CTA', () => {
    const { getByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));
    expect(getByTestId('create-wallet-seed-container')).toBeTruthy();
    expect(getByTestId('create-wallet-word-1')).toBeTruthy();
    expect(getByTestId('create-wallet-word-12')).toBeTruthy();
  });

  it('disables the continue CTA before the seed is revealed', () => {
    const { getByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-continue-button'));
    // mockRestoreWallet must not fire while the button is disabled.
    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('copies the seed phrase as a space-joined string when "copy" is pressed', async () => {
    const { getByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));
    await act(async () => {
      fireEvent.press(getByTestId('create-wallet-copy-button'));
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    const arg = (Clipboard.setStringAsync as jest.Mock).mock.calls[0]![0];
    expect(typeof arg).toBe('string');
    // 12-word BIP-39 mnemonic — 11 spaces separating the words.
    expect(arg.split(' ')).toHaveLength(12);
  });

  it('restores a wallet and routes to setup-pin on successful create', async () => {
    const { getByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));
    await act(async () => {
      fireEvent.press(getByTestId('create-wallet-continue-button'));
    });
    expect(mockRestoreWallet).toHaveBeenCalledTimes(1);
    expect(mockRestoreWallet).toHaveBeenCalledWith(expect.any(String), 'default');
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/setup-pin');
  });

  it('recovers from an "already exists" error by deleting and recreating', async () => {
    mockRestoreWallet
      .mockRejectedValueOnce(new Error('Wallet already exists for this identifier'))
      .mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));
    await act(async () => {
      fireEvent.press(getByTestId('create-wallet-continue-button'));
    });
    expect(mockDeleteWallet).toHaveBeenCalledWith('default');
    expect(mockRestoreWallet).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/setup-pin');
  });

  it('shows the localized error message and stays on the screen when restoreWallet fails for an unrelated reason', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockRestoreWallet.mockRejectedValueOnce(new Error('WDK worklet timeout'));
    const { getByTestId, findByText } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));
    await act(async () => {
      fireEvent.press(getByTestId('create-wallet-continue-button'));
    });
    expect(await findByText('onboarding.createError')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
