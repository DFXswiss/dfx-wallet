import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { copySensitive } from '@/services/clipboard';

jest.mock('@/services/clipboard', () => ({ copySensitive: jest.fn() }));

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
    mockPreventScreenCapture.mockReset();
    mockAllowScreenCapture.mockReset();
    mockPreventScreenCapture.mockResolvedValue(undefined);
    mockAllowScreenCapture.mockResolvedValue(undefined);
    (copySensitive as jest.Mock).mockReset();
    (copySensitive as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders the seed card with the reveal CTA hidden until tapped', () => {
    const { getByTestId, queryByTestId } = render(<CreateWalletScreen />);
    expect(getByTestId('create-wallet-screen')).toBeTruthy();
    expect(getByTestId('create-wallet-reveal-button')).toBeTruthy();
    expect(queryByTestId('create-wallet-seed-container')).toBeNull();
  });

  it('keeps seed words hidden until screen-capture protection becomes active', async () => {
    let resolveProtection: (() => void) | undefined;
    mockPreventScreenCapture.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveProtection = resolve;
        }),
    );
    const { getByTestId, queryByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));
    expect(queryByTestId('create-wallet-seed-container')).toBeNull();
    expect(getByTestId('create-wallet-protection-loading')).toBeTruthy();
    await waitFor(() =>
      expect(mockPreventScreenCapture).toHaveBeenCalledWith(
        expect.stringMatching(/^create-wallet-seed:/),
      ),
    );

    await act(async () => {
      resolveProtection!();
    });

    expect(getByTestId('create-wallet-seed-container')).toBeTruthy();
    expect(getByTestId('create-wallet-word-1')).toBeTruthy();
    expect(getByTestId('create-wallet-word-12')).toBeTruthy();
  });

  it('shows a warning and the seed when screen-capture protection is unavailable', async () => {
    mockPreventScreenCapture.mockRejectedValueOnce(new Error('native failure'));
    const { getByTestId, getByText } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));

    await waitFor(() => expect(getByTestId('create-wallet-seed-container')).toBeTruthy());
    expect(getByText('common.screenCaptureUnavailable')).toBeTruthy();
  });

  it('releases seed capture protection on unmount', async () => {
    const view = render(<CreateWalletScreen />);
    fireEvent.press(view.getByTestId('create-wallet-reveal-button'));
    await waitFor(() => expect(view.getByTestId('create-wallet-seed-container')).toBeTruthy());
    const protectionTag = mockPreventScreenCapture.mock.calls[0]![0]!;
    view.unmount();
    await waitFor(() => expect(mockAllowScreenCapture).toHaveBeenCalledWith(protectionTag));
  });

  it('disables the continue CTA before the seed is revealed', () => {
    const { getByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-continue-button'));
    // mockRestoreWallet must not fire while the button is disabled.
    expect(mockRestoreWallet).not.toHaveBeenCalled();
  });

  it('copies the seed phrase as a space-joined string when "copy" is pressed', async () => {
    let scheduled: (() => void) | undefined;
    const realSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = jest
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: () => void, ms?: number) => {
        if (ms === 2000) {
          scheduled = cb;
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }
        return realSetTimeout.call(globalThis, cb, ms);
      }) as unknown as typeof setTimeout);
    try {
      const { getByTestId } = render(<CreateWalletScreen />);
      fireEvent.press(getByTestId('create-wallet-reveal-button'));
      await waitFor(() => expect(getByTestId('create-wallet-seed-container')).toBeTruthy());
      await act(async () => {
        fireEvent.press(getByTestId('create-wallet-copy-button'));
      });
      expect(copySensitive).toHaveBeenCalledTimes(1);
      const arg = (copySensitive as jest.Mock).mock.calls[0]![0];
      expect(typeof arg).toBe('string');
      // 12-word BIP-39 mnemonic — 11 spaces separating the words.
      expect(arg.split(' ')).toHaveLength(12);
      // Fire the captured "copied → not copied" reset callback (simulates
      // the 2 s timer firing) so the inner arrow gets coverage.
      expect(scheduled).toBeDefined();
      await act(async () => {
        scheduled!();
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('restores a wallet and routes to setup-pin on successful create', async () => {
    const { getByTestId } = render(<CreateWalletScreen />);
    fireEvent.press(getByTestId('create-wallet-reveal-button'));
    await waitFor(() => expect(getByTestId('create-wallet-seed-container')).toBeTruthy());
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
    await waitFor(() => expect(getByTestId('create-wallet-seed-container')).toBeTruthy());
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
    await waitFor(() => expect(getByTestId('create-wallet-seed-container')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('create-wallet-continue-button'));
    });
    expect(await findByText('onboarding.createError')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('back-button falls back to router.replace(welcome) when no history exists', () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByLabelText } = render(<CreateWalletScreen />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/welcome');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('back-button uses router.back() when history is available', () => {
    mockCanGoBack.mockReturnValue(true);
    const { getByLabelText } = render(<CreateWalletScreen />);
    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
