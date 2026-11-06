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
jest.mock('@/store', () => ({
  useAuthStore: () => ({
    setPin: mockSetPin,
    setAuthenticated: mockSetAuthenticated,
  }),
}));

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
    mockSetPin.mockResolvedValue(undefined);
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
});
