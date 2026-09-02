import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUnlock = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({ unlock: mockUnlock }),
}));

const mockVerifyPin = jest.fn();
const mockSetAuthenticated = jest.fn();
const mockAuthenticateBiometric = jest.fn();
const mockAuthState = { biometricEnabled: false };
jest.mock('@/store', () => ({
  useAuthStore: () => ({
    verifyPin: mockVerifyPin,
    setAuthenticated: mockSetAuthenticated,
    authenticateBiometric: mockAuthenticateBiometric,
    biometricEnabled: mockAuthState.biometricEnabled,
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

import VerifyPinScreen from '../../src/features/pin/VerifyPinScreenImpl';

async function enterPin(getByTestId: (id: string) => unknown, digits: string) {
  for (const d of digits) {
    await act(async () => {
      fireEvent.press(getByTestId(`pin-key-${d}`) as Parameters<typeof fireEvent.press>[0]);
    });
  }
}

describe('VerifyPinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockReset();
    mockSetAuthenticated.mockReset();
    mockVerifyPin.mockReset();
    mockUnlock.mockReset();
    mockAuthenticateBiometric.mockReset();
    mockVerifyPin.mockResolvedValue(false);
    mockUnlock.mockResolvedValue(undefined);
    mockAuthenticateBiometric.mockResolvedValue(false);
    mockAuthState.biometricEnabled = false;
  });

  it('verifies the 6-digit PIN, authenticates and unlocks the wallet on success', async () => {
    mockVerifyPin.mockResolvedValue(true);
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    expect(mockVerifyPin).toHaveBeenCalledWith('123456');
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockUnlock).toHaveBeenCalledWith('default');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });

  it('authenticates only after the wallet unlock resolves', async () => {
    mockVerifyPin.mockResolvedValue(true);
    const calls: string[] = [];
    let resolveUnlock: () => void = () => {};
    mockUnlock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUnlock = resolve;
          calls.push('unlock');
        }),
    );
    mockSetAuthenticated.mockImplementation(() => void calls.push('auth'));
    mockReplace.mockImplementation(() => void calls.push('route'));

    const { getByTestId } = render(<VerifyPinScreen />);
    await enterPin(getByTestId, '123456');

    // Unlock is still pending: neither auth nor navigation may have happened.
    expect(calls).toEqual(['unlock']);

    await act(async () => {
      resolveUnlock();
    });

    expect(calls).toEqual(['unlock', 'auth', 'route']);
  });

  it('only submits once the 6th digit is entered', async () => {
    const { getByTestId } = render(<VerifyPinScreen />);
    await enterPin(getByTestId, '12345');
    expect(mockVerifyPin).not.toHaveBeenCalled();
    await enterPin(getByTestId, '6');
    expect(mockVerifyPin).toHaveBeenCalledTimes(1);
  });

  it('shows the error feedback and does not authenticate on a wrong PIN', async () => {
    mockVerifyPin.mockResolvedValue(false);
    const { getByTestId, queryByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '000000');

    expect(getByTestId('verify-pin-error')).toBeTruthy();
    expect(mockSetAuthenticated).not.toHaveBeenCalled();
    expect(mockUnlock).not.toHaveBeenCalled();
    expect(queryByTestId('verify-pin-locked')).toBeNull();
  });

  it('treats a thrown verifyPin as a failed attempt instead of crashing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockVerifyPin.mockRejectedValue(new Error('keystore unavailable'));
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '111111');

    expect(getByTestId('verify-pin-error')).toBeTruthy();
    expect(mockSetAuthenticated).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays fail-closed when the wallet unlock rejects a correct PIN', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockVerifyPin.mockResolvedValue(true);
    mockUnlock.mockRejectedValue(new Error('secret unlock detail'));
    const { getByTestId, queryByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    const message = getByTestId('verify-pin-unlock-error').children.join('');
    // The screen renders the generic i18n message; nothing from the thrown
    // error reaches the UI.
    expect(message).toBe('pin.unlockFailed');
    expect(message).not.toContain('secret unlock detail');
    expect(mockSetAuthenticated).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    // The user stays on the verify screen and can retry.
    expect(getByTestId('verify-pin-screen')).toBeTruthy();
    expect(queryByTestId('verify-pin-recovery-button')).toBeTruthy();
    warn.mockRestore();
  });

  it('routes the recovery button to the restore-wallet screen', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockVerifyPin.mockResolvedValue(true);
    mockUnlock.mockRejectedValue(new Error('worklet not booted'));
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');
    await act(async () => {
      fireEvent.press(getByTestId('verify-pin-recovery-button'));
    });

    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/restore-wallet');
    expect(mockSetAuthenticated).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays fail-closed when a successful biometric is followed by a rejected unlock', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockAuthState.biometricEnabled = true;
    mockAuthenticateBiometric.mockResolvedValue(true);
    mockUnlock.mockRejectedValue(new Error('worklet not booted'));
    const { getByTestId } = render(<VerifyPinScreen />);

    await waitFor(() => expect(mockUnlock).toHaveBeenCalledWith('default'));

    expect(mockSetAuthenticated).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(getByTestId('verify-pin-unlock-error')).toBeTruthy();
    expect(getByTestId('verify-pin-recovery-button')).toBeTruthy();
    warn.mockRestore();
  });

  it('authenticates and navigates after a successful biometric unlock', async () => {
    mockAuthState.biometricEnabled = true;
    mockAuthenticateBiometric.mockResolvedValue(true);
    const { getByTestId } = render(<VerifyPinScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));

    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(getByTestId('verify-pin-screen')).toBeTruthy();
  });

  it('locks the screen after the maximum number of failed attempts', async () => {
    mockVerifyPin.mockResolvedValue(false);
    const { getByTestId, queryByTestId } = render(<VerifyPinScreen />);

    for (let i = 0; i < 5; i++) {
      await enterPin(getByTestId, '999999');
    }

    expect(getByTestId('verify-pin-locked')).toBeTruthy();
    // The numpad must be gone so no further attempts are possible.
    expect(queryByTestId('pin-key-1')).toBeNull();
  });

  it('auto-prompts biometric unlock on mount when enabled', async () => {
    mockAuthState.biometricEnabled = true;
    const { getByTestId } = render(<VerifyPinScreen />);
    await waitFor(() => expect(mockAuthenticateBiometric).toHaveBeenCalledTimes(1));
    expect(getByTestId('verify-pin-biometric-button')).toBeTruthy();
  });

  it('does not prompt biometrics when disabled', async () => {
    mockAuthState.biometricEnabled = false;
    const { queryByTestId } = render(<VerifyPinScreen />);
    await act(async () => {}); // flush mount effects
    expect(mockAuthenticateBiometric).not.toHaveBeenCalled();
    expect(queryByTestId('verify-pin-biometric-button')).toBeNull();
  });
});
