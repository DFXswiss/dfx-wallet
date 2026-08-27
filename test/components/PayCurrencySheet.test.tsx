import { fireEvent, render } from '@testing-library/react-native';
import { PayCurrencySheet } from '../../src/features/buy-sell/PayCurrencySheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components', () => {
  const { Text } = require('react-native');
  return {
    Icon: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('@/theme', () => ({
  Typography: {
    bodyLarge: {},
    bodyMedium: {},
    headlineSmall: {},
  },
  useColors: () => ({
    border: '#dddddd',
    primary: '#0066ff',
    primaryLight: '#e6f0ff',
    surface: '#ffffff',
    text: '#111111',
  }),
}));

jest.mock('../../src/features/buy-sell/BuyScreenImpl', () => ({
  CURRENCIES: ['CHF', 'EUR'] as const,
}));

describe('PayCurrencySheet', () => {
  it('shows both currencies, selects a currency, and marks the selected row', () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <PayCurrencySheet visible onClose={jest.fn()} selected="CHF" onSelect={onSelect} />,
    );

    expect(getByText('CHF')).toBeTruthy();
    expect(getByText('EUR')).toBeTruthy();
    expect(getByTestId('pay-currency-option-CHF-check')).toBeTruthy();
    expect(queryByTestId('pay-currency-option-EUR-check')).toBeNull();

    fireEvent.press(getByTestId('pay-currency-option-EUR'));

    expect(onSelect).toHaveBeenCalledWith('EUR');
  });

  it('keeps the backdrop outside the currency option subtree', () => {
    const { getByTestId } = render(
      <PayCurrencySheet visible onClose={jest.fn()} selected="CHF" onSelect={jest.fn()} />,
    );

    const backdrop = getByTestId('pay-currency-sheet-backdrop');

    expect(backdrop.findAllByProps({ testID: 'pay-currency-option-EUR' })).toHaveLength(0);
  });
});
