import { fireEvent, render } from '@testing-library/react-native';

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
  useColors: () => ({
    background: '#f0f0f0',
    border: '#dddddd',
    cardOverlay: '#ffffff',
    text: '#111111',
    textTertiary: '#777777',
  }),
  useResolvedScheme: () => 'light',
  Typography: {
    headlineSmall: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
    bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  },
}));

jest.mock('../../src/features/buy-sell/TradeModeTabs', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ active }: { active: string }) => (
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
    const { getAllByText, getByLabelText, getByTestId, getByText } = render(<SwapScreenImpl />);

    expect(getByTestId('swap-screen')).toBeTruthy();
    expect(getAllByText('Swap')).toHaveLength(2);
    expect(getByText('Swap is coming soon.')).toBeTruthy();
    expect(getByLabelText('swap')).toBeTruthy();
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
