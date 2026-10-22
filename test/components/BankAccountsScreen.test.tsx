import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
  };
});

const mockAccounts: {
  current: { id: number; iban: string; label?: string }[];
} = { current: [] };
jest.mock('@/features/transfer/useBankAccounts', () => ({
  useBankAccounts: () => mockAccounts.current,
}));

// eslint-disable-next-line import/first
import BankAccountsScreen from '../../src/features/bank-accounts/BankAccountsScreen';

const renderScreen = () =>
  render(
    <ThemeProvider>
      <BankAccountsScreen />
    </ThemeProvider>,
  );

describe('BankAccountsScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAccounts.current = [];
  });

  it('lists active accounts with masked IBANs', () => {
    mockAccounts.current = [
      { id: 7, iban: 'CH9300762011623852957', label: 'UBS' },
      { id: 8, iban: 'DE89370400440532013000' },
    ];

    const screen = renderScreen();

    expect(screen.getByText('bankAccounts.title')).toBeTruthy();
    expect(screen.getByTestId('bank-accounts-row-7')).toBeTruthy();
    expect(screen.getByText('UBS')).toBeTruthy();
    expect(screen.getByText('CH93 •••• 2957')).toBeTruthy();
    expect(screen.getByTestId('bank-accounts-row-8')).toBeTruthy();
    expect(screen.getByText('send.accountBank')).toBeTruthy();
    expect(screen.getByText('DE89 •••• 3000')).toBeTruthy();
  });

  it('shows only the add row and hint for an empty list', () => {
    const screen = renderScreen();

    expect(screen.queryByTestId(/^bank-accounts-row-/)).toBeNull();
    expect(screen.getByTestId('bank-accounts-add')).toBeTruthy();
    expect(screen.getByText('bankAccounts.listHint')).toBeTruthy();
  });

  it('opens the add-bank-account route', () => {
    const screen = renderScreen();

    fireEvent.press(screen.getByTestId('bank-accounts-add'));

    expect(mockPush).toHaveBeenCalledWith('/(auth)/bank-accounts/add');
  });
});
