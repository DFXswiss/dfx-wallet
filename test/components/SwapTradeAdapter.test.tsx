import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TRADE_STEP_GAP } from '../../src/features/buy-sell/tradePanelStyles';
import { SwapTradeAdapter } from '../../src/features/buy-sell/SwapTradeAdapter';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'swap.title': 'Swap',
        'swap.comingSoon': 'Swap is coming soon.',
        'buy.youPay': 'You pay',
        'buy.receiveLabel': 'You receive',
      })[key] ?? key,
  }),
}));

jest.mock('@/theme', () => ({
  Typography: { bodySmall: {}, headlineSmall: {} },
  useColors: () => ({
    background: '#ffffff',
    border: '#dddddd',
    borderLight: '#eeeeee',
    cardOverlay: '#ffffff',
    primary: '#0066ff',
    primaryLight: '#e6f0ff',
    surface: '#ffffff',
    text: '#111111',
    textTertiary: '#777777',
  }),
  useResolvedScheme: () => 'light',
}));

jest.mock('../../src/components/Icon', () => {
  const ReactActual = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Icon: () => ReactActual.createElement(Text, null, 'icon'),
  };
});

const mockOnShellChange = jest.fn();

beforeEach(() => {
  mockOnShellChange.mockReset();
});

describe('SwapTradeAdapter', () => {
  it('renders the swap placeholder content, disabled CTA, and reports its shell chrome', () => {
    const { getByTestId, getAllByText } = render(
      <SwapTradeAdapter onShellChange={mockOnShellChange} />,
    );

    expect(getByTestId('swap-screen')).toBeTruthy();
    // "Swap" appears once in this adapter's own content: the CTA. The header
    // title is chrome owned by `TradeScreen`'s shared shell — see TradeScreen.test.tsx.
    expect(getAllByText('Swap', { exact: true })).toHaveLength(1);
    expect(getAllByText('Swap is coming soon.')).toHaveLength(1);
    expect(getByTestId('swap-amount-panels')).toBeTruthy();
    expect(getByTestId('swap-pay-amount')).toBeTruthy();
    expect(getByTestId('swap-receive-amount')).toBeTruthy();
    expect(getByTestId('swap-fees-panel')).toBeTruthy();
    expect(getByTestId('swap-cta').props.accessibilityState.disabled).toBe(true);
    expect(StyleSheet.flatten(getByTestId('swap-step-content').props.style).gap).toBe(
      TRADE_STEP_GAP,
    );

    expect(mockOnShellChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Swap',
        headerTestID: 'swap-header',
        activeStep: 0,
        steps: ['amount'],
      }),
    );
  });
});
