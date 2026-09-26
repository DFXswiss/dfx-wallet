import { fireEvent, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { GlassListGroup } from '../../src/components/GlassListGroup';
import { PayCurrencySheet } from '../../src/features/buy-sell/PayCurrencySheet';

const MockText = Text;
const MockView = View;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
  };
});

jest.mock('@/components', () => {
  return {
    Icon: ({ name }: { name: string }) => <MockText>{name}</MockText>,
  };
});

// The sheet now renders `GlassSheet`/`GlassListGroup` for real — they need
// the actual theme tokens (`Card`, `Radius`, `useGlassRecipe`, …) instead of
// a hand-picked color subset.
jest.mock('@/theme', () => ({
  ...jest.requireActual('@/theme'),
}));

const CURRENCIES = ['CHF', 'EUR'] as const;

describe('PayCurrencySheet', () => {
  it('shows both currencies, selects a currency, and marks the selected row', () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <PayCurrencySheet
        visible
        onClose={jest.fn()}
        currencies={CURRENCIES}
        selected="CHF"
        onSelect={onSelect}
      />,
    );

    expect(getByText('CHF')).toBeTruthy();
    expect(getByText('EUR')).toBeTruthy();
    expect(getByTestId('pay-currency-option-CHF-check')).toBeTruthy();
    expect(queryByTestId('pay-currency-option-EUR-check')).toBeNull();

    fireEvent.press(getByTestId('pay-currency-option-EUR'));

    expect(onSelect).toHaveBeenCalledWith('EUR');
  });

  it('closes on backdrop press without selecting a currency', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <PayCurrencySheet
        visible
        onClose={onClose}
        currencies={CURRENCIES}
        selected="CHF"
        onSelect={onSelect}
      />,
    );

    fireEvent.press(getByTestId('pay-currency-sheet-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the currency list as a GlassListGroup', () => {
    const { UNSAFE_getAllByType } = render(
      <PayCurrencySheet
        visible
        onClose={jest.fn()}
        currencies={CURRENCIES}
        selected="CHF"
        onSelect={jest.fn()}
      />,
    );

    expect(UNSAFE_getAllByType(GlassListGroup).length).toBeGreaterThan(0);
  });
});
