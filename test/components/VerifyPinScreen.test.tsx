import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUnlock = jest.fn();
const mockWdk = { status: 'INITIALIZING' };
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWalletManager: () => ({ unlock: mockUnlock }),
  useWdkApp: () => ({ state: { status: mockWdk.status } }),
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
    mockVerifyPin.mockResolvedValue(false);
    mockUnlock.mockResolvedValue(undefined);
    mockAuthenticateBiometric.mockResolvedValue(false);
    mockAuthState.biometricEnabled = false;
    mockWdk.status = 'INITIALIZING';
  });

  it('verifies the 6-digit PIN, authenticates and unlocks the wallet on success', async () => {
    mockVerifyPin.mockResolvedValue(true);
    const { getByTestId } = render(<VerifyPinScreen />);

    await enterPin(getByTestId, '123456');

    expect(mockVerifyPin).toHaveBeenCalledWith('123456');
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockUnlock).toHaveBeenCalledWith('default');
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

  it('navigates to the dashboard once the wallet reports READY', async () => {
    mockWdk.status = 'READY';
    render(<VerifyPinScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard'));
  });
});
