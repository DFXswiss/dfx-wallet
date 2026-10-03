import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/config/features', () => ({
  FEATURES: { BIOMETRIC: true, DFX_BACKEND: false, LEGAL: true },
}));
const { FEATURES: mockFeatures } = jest.requireMock('@/config/features') as {
  FEATURES: { BIOMETRIC: boolean; DFX_BACKEND: boolean; LEGAL: boolean };
};

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
const mockSetOnboarded = jest.fn();
const mockAuthenticateBiometric = jest.fn();
const mockAuthState: {
  biometricEnabled: boolean;
  failedAttempts: number;
  isOnboarded: boolean;
  lockedUntil: number | null;
  pinHash: string | null;
} = {
  biometricEnabled: false,
  failedAttempts: 0,
  isOnboarded: true,
  lockedUntil: null,
  pinHash: 'pin$argon2id$current',
};
jest.mock('@/store', () => ({
  useAuthStore: () => ({
    verifyPin: mockVerifyPin,
    setAuthenticated: mockSetAuthenticated,
    authenticateBiometric: mockAuthenticateBiometric,
    biometricEnabled: mockAuthState.biometricEnabled,
    failedAttempts: mockAuthState.failedAttempts,
    isOnboarded: mockAuthState.isOnboarded,
    lockedUntil: mockAuthState.lockedUntil,
    pinHash: mockAuthState.pinHash,
    setOnboarded: mockSetOnboarded,
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
    mockSetOnboarded.mockReset();
    mockSetOnboarded.mockResolvedValue(undefined);
    mockVerifyPin.mockReset();
    mockUnlock.mockReset();
    mockAuthenticateBiometric.mockReset();
    mockVerifyPin.mockResolvedValue(false);
    mockUnlock.mockResolvedValue(undefined);
    mockAuthenticateBiometric.mockResolvedValue(false);
    mockFeatures.LEGAL = true;
    mockAuthState.biometricEnabled = false;
    mockAuthState.failedAttempts = 0;
    mockAuthState.isOnboarded = true;
    mockAuthState.lockedUntil = null;
    mockAuthState.pinHash = 'pin$argon2id$current';
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
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

  it('routes successful PIN verification to legal when onboarding is incomplete', async () => {
    mockAuthState.isOnboarded = false;
    mockVerifyPin.mockResolvedValue(true);
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    expect(mockSetOnboarded).not.toHaveBeenCalled();
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/legal-disclaimer');
  });

  it('completes onboarding before the dashboard when legal is disabled', async () => {
    mockFeatures.LEGAL = false;
    mockAuthState.isOnboarded = false;
    mockVerifyPin.mockResolvedValue(true);
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });

  it('shows an error and allows retry when finishing authentication rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFeatures.LEGAL = false;
    mockAuthState.isOnboarded = false;
    mockVerifyPin.mockResolvedValue(true);
    mockSetOnboarded.mockImplementationOnce(async () => {
      throw new Error('keychain unavailable');
    });
    const { getByTestId, queryByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    await waitFor(() =>
      expect(getByTestId('verify-pin-error').children.join('')).toBe('pin.finishError'),
    );
    expect(queryByTestId('pin-processing-overlay')).toBeNull();
    expect(mockSetAuthenticated).toHaveBeenCalledWith(false);
    expect(mockReplace).not.toHaveBeenCalled();

    await enterPin(getByTestId, '123456');

    expect(mockVerifyPin).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
    warn.mockRestore();
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

  it('requires explicit submit for 4- and 5-digit legacy PINs', async () => {
    mockAuthState.pinHash = 'abcdef';
    const { getByTestId } = render(<VerifyPinScreen />);

    expect(getByTestId('verify-pin-submit').props.accessibilityState?.disabled).toBe(true);
    await enterPin(getByTestId, '123');
    expect(getByTestId('verify-pin-submit').props.accessibilityState?.disabled).toBe(true);
    await enterPin(getByTestId, '4');
    expect(getByTestId('verify-pin-submit').props.accessibilityState?.disabled).toBeFalsy();
    expect(mockVerifyPin).not.toHaveBeenCalled();
    await enterPin(getByTestId, '5');
    expect(getByTestId('verify-pin-submit').props.accessibilityState?.disabled).toBeFalsy();
    expect(mockVerifyPin).not.toHaveBeenCalled();
  });

  it('counts one wrong 4-digit legacy PIN submission and shows the error', async () => {
    mockAuthState.pinHash = 'abcdef';
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '1234');
    await act(async () => {
      fireEvent.press(getByTestId('verify-pin-submit'));
    });

    expect(mockVerifyPin).toHaveBeenCalledTimes(1);
    expect(mockVerifyPin.mock.calls[0]).toEqual(['1234']);
    expect(getByTestId('verify-pin-error')).toBeTruthy();
  });

  it('shows the processing overlay while a legacy submit is pending', async () => {
    mockAuthState.pinHash = 'abcdef';
    mockVerifyPin.mockImplementation(() => new Promise<boolean>(() => undefined));
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '1234');
    await act(async () => {
      fireEvent.press(getByTestId('verify-pin-submit'));
    });

    expect(getByTestId('pin-processing-overlay')).toBeTruthy();
    expect(getByTestId('verify-pin-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('ignores further digits while a successful legacy unlock is pending', async () => {
    let resolveUnlock: () => void = () => undefined;
    mockAuthState.pinHash = 'abcdef';
    mockVerifyPin.mockImplementation(async (pin: string) => pin === '1234');
    mockUnlock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUnlock = resolve;
        }),
    );
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '1234');
    await act(async () => {
      fireEvent.press(getByTestId('verify-pin-submit'));
    });
    expect(mockUnlock).toHaveBeenCalledTimes(1);

    await enterPin(getByTestId, '56');

    expect(mockVerifyPin).toHaveBeenCalledTimes(1);
    expect(mockVerifyPin).not.toHaveBeenCalledWith('123456');

    await act(async () => resolveUnlock());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });

  it.each(['1234', '12345'])('unlocks a valid %s legacy PIN via submit', async (legacyPin) => {
    mockAuthState.pinHash = 'abcdef';
    mockVerifyPin.mockImplementation(async (pin: string) => pin === legacyPin);
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, legacyPin);
    await act(async () => {
      fireEvent.press(getByTestId('verify-pin-submit'));
    });

    expect(mockVerifyPin.mock.calls).toEqual([[legacyPin]]);
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockUnlock).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('auto-verifies a 6-digit legacy PIN exactly once as a counted attempt', async () => {
    mockAuthState.pinHash = 'abcdef';
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    expect(mockVerifyPin.mock.calls).toEqual([['123456']]);
    expect(getByTestId('verify-pin-error')).toBeTruthy();
  });

  it('shows the processing overlay while final PIN verification is pending', async () => {
    mockVerifyPin.mockImplementation(() => new Promise<boolean>(() => undefined));
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    expect(getByTestId('pin-processing-overlay')).toBeTruthy();
  });

  it('hides the processing overlay again after a wrong PIN', async () => {
    let resolveVerification: (value: boolean) => void = () => undefined;
    mockVerifyPin.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveVerification = resolve;
        }),
    );
    const { getByTestId, queryByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');
    expect(getByTestId('pin-processing-overlay')).toBeTruthy();

    await act(async () => {
      resolveVerification(false);
    });

    await waitFor(() => expect(queryByTestId('pin-processing-overlay')).toBeNull());
    expect(getByTestId('verify-pin-error')).toBeTruthy();
  });

  it('does not submit or show the overlay for a partial PIN', async () => {
    mockVerifyPin.mockImplementation(() => new Promise<boolean>(() => undefined));
    const { getByTestId, queryByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '1234');

    expect(mockVerifyPin).not.toHaveBeenCalled();
    expect(queryByTestId('pin-processing-overlay')).toBeNull();
  });

  it('hides the overlay when wallet unlock throws', async () => {
    let rejectUnlock: (reason?: unknown) => void = () => undefined;
    mockVerifyPin.mockResolvedValue(true);
    mockUnlock.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectUnlock = reject;
        }),
    );
    const { getByTestId, queryByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');
    expect(getByTestId('pin-processing-overlay')).toBeTruthy();

    await act(async () => {
      rejectUnlock(new Error('wallet unavailable'));
    });

    await waitFor(() => expect(queryByTestId('pin-processing-overlay')).toBeNull());
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
    expect(mockAuthenticateBiometric).toHaveBeenCalledWith({
      promptMessage: 'biometric.prompt',
      cancelLabel: 'biometric.usePin',
    });
    expect(getByTestId('verify-pin-screen')).toBeTruthy();
  });

  it('shows remaining attempts from persistent state after an incorrect PIN', async () => {
    mockAuthState.failedAttempts = 3;
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '999999');

    expect(getByTestId('verify-pin-error').children.join('')).toBe(
      'pin.incorrectAttemptsLeft:{"count":2}',
    );
  });

  it('shows a ticking persistent lockout, blocks PIN input and clears its timer', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    mockAuthState.failedAttempts = 5;
    mockAuthState.lockedUntil = Date.now() + 30_000;
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { getByTestId, unmount } = render(<VerifyPinScreen />);

    expect(getByTestId('verify-pin-locked').children.join('')).toBe(
      'pin.lockedFor:{"count":30}',
    );
    expect(getByTestId('pin-key-1').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('pin-key-delete').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByTestId('pin-key-1'));
    expect(mockVerifyPin).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(getByTestId('verify-pin-locked').children.join('')).toBe(
      'pin.lockedFor:{"count":29}',
    );

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('disables the legacy submit when the store reports a lockout', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    mockAuthState.pinHash = 'abcdef';
    const view = render(<VerifyPinScreen />);

    await enterPin(view.getByTestId, '1234');
    expect(
      view.getByTestId('verify-pin-submit').props.accessibilityState?.disabled,
    ).toBeFalsy();

    mockAuthState.failedAttempts = 5;
    mockAuthState.lockedUntil = Date.now() + 30_000;
    view.rerender(<VerifyPinScreen />);

    expect(view.getByTestId('verify-pin-locked')).toBeTruthy();
    expect(view.getByTestId('pin-key-1').props.accessibilityState?.disabled).toBe(true);
    expect(view.getByTestId('verify-pin-submit').props.accessibilityState?.disabled).toBe(true);
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
