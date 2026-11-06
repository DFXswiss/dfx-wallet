import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { TRADE_STEP_GAP } from '../../src/features/buy-sell/tradePanelStyles';
import { SwapTradeAdapter } from '../../src/features/buy-sell/SwapTradeAdapter';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: mockCanGoBack,
    replace: mockReplace,
  }),
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

// The amount panels and fees panel now render `GlassCard`/`GlassIconButton`
// for real — they need the actual theme tokens instead of a hand-picked
// color subset.
jest.mock('@/theme', () => ({
  ...jest.requireActual('@/theme'),
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
  mockBack.mockReset();
  mockCanGoBack.mockReset();
  mockReplace.mockReset();
  mockOnShellChange.mockReset();
});

describe('SwapTradeAdapter', () => {
  const invokeReportedBack = () => {
    const calls = mockOnShellChange.mock.calls;
    const shell = calls[calls.length - 1]?.[0] as { onBack: () => void } | undefined;
    expect(shell).toEqual(expect.objectContaining({ headerTestID: 'swap-header' }));
    shell?.onBack();
  };

  it('renders the swap placeholder content, disabled CTA, and reports its shell chrome', () => {
    const { getByTestId, getAllByText, UNSAFE_getAllByType } = render(
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
    // The shared amount panels and fees panel render on `GlassCard`.
    expect(UNSAFE_getAllByType(GlassCard).length).toBeGreaterThan(0);

    expect(mockOnShellChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Swap',
        headerTestID: 'swap-header',
        activeStep: 0,
        steps: ['amount'],
      }),
    );
  });

  it('pops history from the reported back action when the stack is not empty', () => {
    mockCanGoBack.mockReturnValue(true);
    render(<SwapTradeAdapter onShellChange={mockOnShellChange} />);

    invokeReportedBack();

    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces to the dashboard from the reported back action when the stack is empty', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<SwapTradeAdapter onShellChange={mockOnShellChange} />);

    invokeReportedBack();

    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });
});
