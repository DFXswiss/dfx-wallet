import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockBack = jest.fn();
let mockFocusCallback: (() => void | Promise<void>) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | Promise<void>) => {
    mockFocusCallback = callback;
  },
  useRouter: () => ({
    push: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View: SafeView } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <SafeView {...rest}>{children}</SafeView>
    ),
  };
});

const mockCreateBankAccount = jest.fn();
const mockInterpretDfxAuthError = jest.fn();
jest.mock('@/features/dfx-backend/services', () => ({
  dfxPaymentService: {
    createBankAccount: (...args: unknown[]) => mockCreateBankAccount(...args),
  },
  interpretDfxAuthError: (...args: unknown[]) => mockInterpretDfxAuthError(...args),
}));

jest.mock('@/features/dfx-backend/DfxAuthGate', () => ({
  DfxAuthGate: ({ gate }: { gate: { kind: string } | null }) => {
    const ReactActual = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');
    return gate ? ReactActual.createElement(View, { testID: 'dfx-auth-gate' }) : null;
  },
}));

const mockAuthState = { isDfxAuthenticated: false };
jest.mock('@/store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

// eslint-disable-next-line import/first
import AddBankAccountScreen from '../../src/features/bank-accounts/AddBankAccountScreen';

const VALID_IBAN = 'CH93 0076 2011 6238 5295 7';

const renderScreen = () =>
  render(
    <ThemeProvider>
      <AddBankAccountScreen />
    </ThemeProvider>,
  );

describe('AddBankAccountScreen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCreateBankAccount.mockReset();
    mockInterpretDfxAuthError.mockReset();
    mockInterpretDfxAuthError.mockReturnValue(null);
    mockAuthState.isDfxAuthenticated = false;
    mockFocusCallback = null;
  });

  it('enables save only for a valid IBAN, including one with spaces', () => {
    const screen = renderScreen();
    const save = screen.getByTestId('bank-account-save');

    expect(save.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('bank-account-iban'), 'invalid');
    expect(screen.getByTestId('bank-account-save').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('bank-account-iban'), VALID_IBAN);
    expect(screen.getByTestId('bank-account-save').props.accessibilityState.disabled).toBe(false);
  });

  it('saves a compact IBAN with its label and goes back', async () => {
    mockCreateBankAccount.mockResolvedValue({ id: 1 });
    const screen = renderScreen();
    fireEvent.changeText(screen.getByTestId('bank-account-iban'), VALID_IBAN);
    fireEvent.changeText(screen.getByTestId('bank-account-label'), 'UBS Privatkonto');

    await act(async () => {
      fireEvent.press(screen.getByTestId('bank-account-save'));
    });

    expect(mockCreateBankAccount).toHaveBeenCalledWith('CH9300762011623852957', 'UBS Privatkonto');
    expect(mockBack).toHaveBeenCalled();
  });

  it('passes undefined when no optional label was entered', async () => {
    mockCreateBankAccount.mockResolvedValue({ id: 2 });
    const screen = renderScreen();
    fireEvent.changeText(screen.getByTestId('bank-account-iban'), VALID_IBAN);

    await act(async () => {
      fireEvent.press(screen.getByTestId('bank-account-save'));
    });

    expect(mockCreateBankAccount).toHaveBeenCalledWith('CH9300762011623852957', undefined);
  });

  it('shows the auth gate and retries the last save after login on focus', async () => {
    const authError = new Error('sign in');
    mockCreateBankAccount.mockRejectedValueOnce(authError).mockResolvedValueOnce({ id: 3 });
    mockInterpretDfxAuthError.mockReturnValueOnce({ kind: 'login', message: 'sign in' });
    const screen = renderScreen();
    fireEvent.changeText(screen.getByTestId('bank-account-iban'), VALID_IBAN);

    await act(async () => {
      fireEvent.press(screen.getByTestId('bank-account-save'));
    });
    expect(mockInterpretDfxAuthError).toHaveBeenCalledWith(authError);
    expect(screen.getByTestId('dfx-auth-gate')).toBeTruthy();

    mockAuthState.isDfxAuthenticated = true;
    screen.rerender(
      <ThemeProvider>
        <AddBankAccountScreen />
      </ThemeProvider>,
    );
    await act(async () => {
      await mockFocusCallback?.();
    });

    expect(mockCreateBankAccount).toHaveBeenCalledTimes(2);
    expect(mockCreateBankAccount.mock.calls[1]).toEqual(['CH9300762011623852957', undefined]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows an inline error for a non-auth failure', async () => {
    mockCreateBankAccount.mockRejectedValueOnce(new Error('offline'));
    const screen = renderScreen();
    fireEvent.changeText(screen.getByTestId('bank-account-iban'), VALID_IBAN);

    await act(async () => {
      fireEvent.press(screen.getByTestId('bank-account-save'));
    });

    await waitFor(() => expect(screen.getByTestId('bank-account-error')).toBeTruthy());
    expect(screen.queryByTestId('dfx-auth-gate')).toBeNull();
  });
});
