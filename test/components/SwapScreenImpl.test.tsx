import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TRADE_STEP_GAP } from '../../src/features/buy-sell/tradePanelStyles';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn() }),
}));

import SwapScreenImpl from '../../src/features/buy-sell/SwapScreenImpl';

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
}));

jest.mock('../../src/features/buy-sell/TradeModeTabs', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    TradeModeTabs: ({ active }: { active: string }) => (
      <View accessibilityLabel={active} testID="trade-mode-tabs" />
    ),
  };
});

jest.mock('@/components', () => {
  const { Text, View } = jest.requireActual('react-native');
  const { AppHeader } = jest.requireActual('@/components/AppHeader');
  return {
    AppHeader,
    DarkBackdrop: () => <View />,
    Icon: () => <Text>icon</Text>,
  };
});

jest.mock('../../src/components/Icon', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Icon: () => <Text>icon</Text>,
  };
});

describe('SwapScreenImpl', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockCanGoBack.mockClear();
    mockReplace.mockClear();
  });

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
    expect(getByTestId('swap-header-back')).toBeTruthy();
    expect(getByTestId('swap-header-progress')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('swap-step-content').props.style).gap).toBe(
      TRADE_STEP_GAP,
    );
  });

  it('navigates back from the header when navigation history exists', () => {
    mockCanGoBack.mockReturnValue(true);
    const { getByTestId } = render(<SwapScreenImpl />);

    expect(getByTestId('swap-screen-header')).toBeTruthy();
    fireEvent.press(getByTestId('swap-screen-header-back'));

    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('returns to the dashboard from the header when navigation history is empty', () => {
    mockCanGoBack.mockReturnValue(false);
    const { getByTestId } = render(<SwapScreenImpl />);

    fireEvent.press(getByTestId('swap-screen-header-back'));

    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/(tabs)/dashboard');
  });
});
