import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockSetPin = jest.fn();
const mockSetAuthenticated = jest.fn();
const mockSetOnboarded = jest.fn();
let mockIsOnboarded = false;
jest.mock('@/store', () => ({
  useAuthStore: () => ({
    isOnboarded: mockIsOnboarded,
    setPin: mockSetPin,
    setAuthenticated: mockSetAuthenticated,
    setOnboarded: mockSetOnboarded,
  }),
}));

const mockUnlock = jest.fn();
let mockWalletStatus = 'UNLOCKED';
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({
    status: mockWalletStatus,
    unlock: (walletId: string) => mockUnlock(walletId),
  }),
}));

jest.mock('@/config/features', () => ({ FEATURES: { LEGAL: false } }));
const { FEATURES: mockFeatures } = jest.requireMock('@/config/features') as {
  FEATURES: { LEGAL: boolean };
};

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

import SetupPinScreen from '../../src/features/pin/SetupPinScreenImpl';

async function enterPin(getByTestId: (id: string) => unknown, digits: string) {
  for (const digit of digits) {
    await act(async () => {
      fireEvent.press(getByTestId(`pin-key-${digit}`) as Parameters<typeof fireEvent.press>[0]);
    });
  }
}

describe('SetupPinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatures.LEGAL = false;
    mockIsOnboarded = false;
    mockWalletStatus = 'UNLOCKED';
    mockSetPin.mockResolvedValue(undefined);
    mockSetOnboarded.mockResolvedValue(undefined);
    mockUnlock.mockResolvedValue(undefined);
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the processing overlay while saving a confirmed PIN', async () => {
    mockSetPin.mockImplementation(() => new Promise<void>(() => undefined));
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    expect(getByTestId('pin-processing-overlay')).toBeTruthy();
    expect(mockSetPin).toHaveBeenCalledWith('123456');
  });

  it('hides the overlay and shows the existing error when saving fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockSetPin.mockRejectedValue(new Error('secure storage unavailable'));
    const { getByTestId, queryByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '654321');
    await enterPin(getByTestId, '654321');

    await waitFor(() => expect(queryByTestId('pin-processing-overlay')).toBeNull());
    expect(getByTestId('setup-pin-error')).toBeTruthy();
    expect(mockSetAuthenticated.mock.calls).toEqual([[true], [false]]);
    warn.mockRestore();
  });

  it('does not show the overlay for a mismatched confirmation', async () => {
    const { getByTestId, queryByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123455');

    expect(queryByTestId('pin-processing-overlay')).toBeNull();
    expect(getByTestId('setup-pin-error')).toBeTruthy();
    expect(mockSetPin).not.toHaveBeenCalled();
  });

  it('unlocks before authenticating and navigating during PIN migration', async () => {
    let resolveUnlock: () => void = () => undefined;
    mockIsOnboarded = true;
    mockWalletStatus = 'LOCKED';
    mockUnlock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUnlock = resolve;
        }),
    );
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    await waitFor(() => expect(mockUnlock).toHaveBeenCalledWith('default'));
    expect(mockSetAuthenticated).not.toHaveBeenCalledWith(true);
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => {
      resolveUnlock();
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
    expect(mockUnlock.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetAuthenticated.mock.invocationCallOrder[0]!,
    );
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockSetPin).toHaveBeenCalledWith('123456');
  });

  it('stays unauthenticated and shows the unlock error when PIN migration unlock fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockIsOnboarded = true;
    mockWalletStatus = 'LOCKED';
    mockUnlock.mockImplementationOnce(async () => {
      throw new Error('wallet unavailable');
    });
    const { getByTestId, getByText } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    await waitFor(() => expect(getByText('pin.unlockFailed')).toBeTruthy());
    expect(mockSetAuthenticated).toHaveBeenCalledWith(false);
    expect(mockSetAuthenticated).not.toHaveBeenCalledWith(true);
    expect(mockSetPin).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps fresh onboarding unlocked without an extra wallet unlock', async () => {
    const { getByTestId, rerender } = render(<SetupPinScreen />);
    mockWalletStatus = 'LOCKED';
    rerender(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
    expect(mockUnlock).not.toHaveBeenCalled();
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockSetPin).toHaveBeenCalledWith('123456');
  });

  it('unlocks an interrupted onboarding wallet before authenticating', async () => {
    let resolveUnlock: () => void = () => undefined;
    mockWalletStatus = 'LOCKED';
    mockUnlock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUnlock = resolve;
        }),
    );
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    await waitFor(() => expect(mockUnlock).toHaveBeenCalledWith('default'));
    expect(mockSetAuthenticated).not.toHaveBeenCalledWith(true);
    await act(async () => {
      resolveUnlock();
    });

    await waitFor(() => expect(mockSetAuthenticated).toHaveBeenCalledWith(true));
    expect(mockUnlock.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetAuthenticated.mock.invocationCallOrder[0]!,
    );
  });

  it('authenticates before finishing onboarding and opening the dashboard when legal is disabled', async () => {
    let resolveOnboarded: () => void = () => undefined;
    mockSetOnboarded.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOnboarded = resolve;
        }),
    );
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockSetAuthenticated.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetOnboarded.mock.invocationCallOrder[0]!,
    );
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => {
      resolveOnboarded();
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
    expect(mockSetAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('rolls authentication back when finishing onboarding fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockSetOnboarded.mockRejectedValue(new Error('keychain unavailable'));
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    await waitFor(() => expect(getByTestId('setup-pin-error')).toBeTruthy());
    expect(mockSetAuthenticated.mock.calls).toEqual([[true], [false]]);
    expect(mockReplace).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('opens the legal disclaimer without marking onboarding complete when legal is enabled', async () => {
    mockFeatures.LEGAL = true;
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/legal-disclaimer'),
    );
    expect(mockSetOnboarded).not.toHaveBeenCalled();
  });
});
