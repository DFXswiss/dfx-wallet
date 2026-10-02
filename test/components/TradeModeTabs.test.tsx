import { fireEvent, render } from '@testing-library/react-native';

import TradeModeTabs from '../../src/features/buy-sell/TradeModeTabs';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/theme', () => {
  const actual = jest.requireActual('@/theme');
  return {
    ...actual,
    useColors: () => ({
      border: '#dddddd',
      card: '#ffffff',
      surfaceLight: '#f5f5f5',
      text: '#111111',
      textTertiary: '#777777',
    }),
  };
});

describe('TradeModeTabs', () => {
  it.each([
    ['buy', 'trade-tab-buy'],
    ['sell', 'trade-tab-sell'],
    ['swap', 'trade-tab-swap'],
  ] as const)('marks %s as selected', (active, selectedTestId) => {
    const { getByTestId } = render(<TradeModeTabs active={active} onChange={jest.fn()} />);

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
    ['sell', 'trade-tab-buy', 'buy'],
    ['buy', 'trade-tab-sell', 'sell'],
    ['buy', 'trade-tab-swap', 'swap'],
  ] as const)('calls onChange(%s→%s) via %s — no navigation', (active, testId, nextMode) => {
    const onChange = jest.fn();
    const { getByTestId } = render(<TradeModeTabs active={active} onChange={onChange} />);

    fireEvent.press(getByTestId(testId));

    expect(onChange).toHaveBeenCalledWith(nextMode);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when pressing the already-active tab', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<TradeModeTabs active="buy" onChange={onChange} />);

    fireEvent.press(getByTestId('trade-tab-buy'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
