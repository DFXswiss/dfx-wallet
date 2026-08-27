import { render } from '@testing-library/react-native';

import SwapScreenImpl from '../../src/features/buy-sell/SwapScreenImpl';

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
    text: '#111111',
    textTertiary: '#777777',
  }),
}));

jest.mock('../../src/features/buy-sell/TradeModeTabs', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ active }: { active: string }) => (
      <View accessibilityLabel={active} testID="trade-mode-tabs" />
    ),
  };
});

jest.mock('../../src/components/Icon', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    Icon: () => <Text>icon</Text>,
  };
});

describe('SwapScreenImpl', () => {
  it('renders the swap placeholder and active swap tabs', () => {
    const { getByLabelText, getByTestId, getByText } = render(<SwapScreenImpl />);

    expect(getByTestId('swap-screen')).toBeTruthy();
    expect(getByText('Swap')).toBeTruthy();
    expect(getByText('Swap is coming soon.')).toBeTruthy();
    expect(getByLabelText('swap')).toBeTruthy();
  });
});
