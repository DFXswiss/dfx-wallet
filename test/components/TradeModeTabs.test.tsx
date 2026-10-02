import { fireEvent, render } from '@testing-library/react-native';

import TradeModeTabs from '../../src/features/buy-sell/TradeModeTabs';

const mockReplace = jest.fn();
let mockSearchParams: Record<string, string | string[] | undefined> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/theme', () => ({
  Typography: {
    bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  },
  useColors: () => ({
    border: '#dddddd',
    card: '#ffffff',
    surfaceLight: '#f5f5f5',
    text: '#111111',
    textTertiary: '#777777',
  }),
}));

describe('TradeModeTabs', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockSearchParams = {};
  });

  it.each([
    ['buy', 'trade-tab-buy'],
    ['sell', 'trade-tab-sell'],
    ['swap', 'trade-tab-swap'],
  ] as const)('marks %s as selected', (active, selectedTestId) => {
    const { getByTestId } = render(<TradeModeTabs active={active} />);

    expect(getByTestId('trade-mode-tabs')).toBeTruthy();
    expect(getByTestId('trade-tab-buy')).toBeTruthy();
    expect(getByTestId('trade-tab-sell')).toBeTruthy();
    expect(getByTestId('trade-tab-swap')).toBeTruthy();
    expect(getByTestId(selectedTestId).props.accessibilityState).toEqual({ selected: true });

    for (const testId of ['trade-tab-buy', 'trade-tab-sell', 'trade-tab-swap']) {
      if (testId !== selectedTestId) {
        expect(getByTestId(testId).props.accessibilityState).toEqual({ selected: false });
      }
    }
  });

  it.each([
    ['sell', 'trade-tab-buy', '/(auth)/buy'],
    ['buy', 'trade-tab-sell', '/(auth)/sell'],
    ['buy', 'trade-tab-swap', '/(auth)/swap'],
  ] as const)('navigates from %s via %s', (active, testId, route) => {
    const { getByTestId } = render(<TradeModeTabs active={active} />);

    fireEvent.press(getByTestId(testId));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: route, params: {} });
  });

  it('preserves all supported route parameters when navigating', () => {
    mockSearchParams = {
      asset: 'BTC',
      chain: 'bitcoin',
      targetAddress: 'bc1qexample',
      targetBlockchain: 'Bitcoin',
    };
    const { getByTestId } = render(<TradeModeTabs active="buy" />);

    fireEvent.press(getByTestId('trade-tab-swap'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/swap',
      params: {
        asset: 'BTC',
        chain: 'bitcoin',
        targetAddress: 'bc1qexample',
        targetBlockchain: 'Bitcoin',
      },
    });
  });

  it('does not preserve unknown or empty route parameters', () => {
    mockSearchParams = {
      asset: '',
      chain: 'ethereum',
      foo: 'x',
    };
    const { getByTestId } = render(<TradeModeTabs active="buy" />);

    fireEvent.press(getByTestId('trade-tab-sell'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/sell',
      params: { chain: 'ethereum' },
    });
  });

  it('does not navigate when the active tab is pressed', () => {
    const { getByTestId } = render(<TradeModeTabs active="swap" />);

    fireEvent.press(getByTestId('trade-tab-swap'));

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
