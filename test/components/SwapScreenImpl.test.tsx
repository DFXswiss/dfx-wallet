import { render } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { TRADE_STEP_GAP } from '../../src/features/buy-sell/tradePanelStyles';
import SwapScreenImpl from '../../src/features/buy-sell/SwapScreenImpl';

const MockText = Text;
const MockView = View;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'swap.title': 'Swap',
        'swap.comingSoon': 'Swap is coming soon.',
      })[key] ?? key,
  }),
}));

jest.mock('@/theme', () => ({
  Typography: { bodySmall: {}, headlineSmall: {} },
  useColors: () => ({
    background: '#ffffff',
    border: '#dddddd',
    cardOverlay: '#ffffff',
    primary: '#0066ff',
    primaryLight: '#e6f0ff',
    surface: '#ffffff',
    text: '#111111',
    textTertiary: '#777777',
  }),
  useResolvedScheme: () => 'light',
}));

jest.mock('../../src/features/buy-sell/TradeModeTabs', () => {
  return {
    __esModule: true,
    default: ({ active }: { active: string }) => (
      <MockView accessibilityLabel={active} testID="trade-mode-tabs" />
    ),
  };
});

jest.mock('../../src/components/Icon', () => {
  return {
    __esModule: true,
    Icon: () => <MockText>icon</MockText>,
  };
});

describe('SwapScreenImpl', () => {
  it('renders the swap placeholder and active swap tabs', () => {
    const { getByLabelText, getByTestId, getAllByText } = render(<SwapScreenImpl />);

    expect(getByTestId('swap-screen')).toBeTruthy();
    expect(getAllByText('Swap', { exact: true })).toHaveLength(3);
    expect(getAllByText('Swap is coming soon.')).toHaveLength(2);
    expect(getByLabelText('swap')).toBeTruthy();
    expect(getByTestId('swap-amount-panels')).toBeTruthy();
    expect(getByTestId('swap-pay-amount')).toBeTruthy();
    expect(getByTestId('swap-receive-amount')).toBeTruthy();
    expect(getByTestId('swap-fees-panel')).toBeTruthy();
    expect(getByTestId('swap-cta').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('swap-header')).toBeTruthy();
    expect(getByTestId('swap-header-background')).toBeTruthy();
    expect(getByTestId('swap-header-back')).toBeTruthy();
    expect(getByTestId('swap-header-progress')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('swap-step-content').props.style).gap).toBe(
      TRADE_STEP_GAP,
    );
  });
});
