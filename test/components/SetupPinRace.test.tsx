import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/config/features', () => ({
  FEATURES: {
    BIOMETRIC: false,
    DFX_BACKEND: false,
    LEGAL: true,
    PIN: true,
  },
}));

jest.mock('@/services/pin', () => ({
  hashPin: jest.fn(async () => 'stored-pin-hash'),
  needsPinRehash: jest.fn(() => false),
  verifyPin: jest.fn(async () => false),
}));

import SetupPinScreen from '../../src/features/pin/SetupPinScreenImpl';
import { secureStorage } from '@/services/storage';
import { useAuthStore } from '@/store/auth';

async function enterPin(getByTestId: (id: string) => unknown, digits: string) {
  for (const digit of digits) {
    await act(async () => {
      fireEvent.press(getByTestId(`pin-key-${digit}`) as Parameters<typeof fireEvent.press>[0]);
    });
  }
}

describe('SetupPinScreen auth-store ordering', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    useAuthStore.setState({
      isAuthenticated: false,
      isOnboarded: false,
      pinHash: null,
    });
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never exposes a persisted PIN hash while the real auth store is unauthenticated', async () => {
    jest.spyOn(secureStorage, 'set').mockResolvedValue(undefined);
    let exposedLockedPin = false;
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.pinHash !== null && !state.isAuthenticated) exposedLockedPin = true;
    });
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '123456');
    await enterPin(getByTestId, '123456');

    await waitFor(() => expect(useAuthStore.getState().pinHash).toBe('stored-pin-hash'));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(exposedLockedPin).toBe(false);
    unsubscribe();
  });

  it('rolls authentication back when the real store cannot persist the PIN', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(secureStorage, 'set').mockRejectedValue(new Error('keychain unavailable'));
    const { getByTestId } = render(<SetupPinScreen />);

    await enterPin(getByTestId, '654321');
    await enterPin(getByTestId, '654321');

    await waitFor(() => expect(getByTestId('setup-pin-error')).toBeTruthy());
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().pinHash).toBeNull();
    warn.mockRestore();
  });
});
