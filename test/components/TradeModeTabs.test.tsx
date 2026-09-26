import { fireEvent, render } from '@testing-library/react-native';

import { GlassPill } from '../../src/components/GlassPill';
import TradeModeTabs from '../../src/features/buy-sell/TradeModeTabs';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The segmented control now renders `GlassSurface`/`GlassPill` for real, so
// it needs the actual theme tokens (`Card`, `Radius`, `useGlassRecipe`, …)
// instead of a hand-picked color subset.
jest.mock('@/theme', () => ({
  ...jest.requireActual('@/theme'),
}));

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
    expect(getByTestId(selectedTestId).props.accessibilityState).toMatchObject({ selected: true });

    for (const testId of ['trade-tab-buy', 'trade-tab-sell', 'trade-tab-swap']) {
      if (testId !== selectedTestId) {
        expect(getByTestId(testId).props.accessibilityState).toMatchObject({ selected: false });
      }
    }
  });

  it('renders the active tab as a selected GlassPill', () => {
    const { UNSAFE_getAllByType } = render(<TradeModeTabs active="sell" onChange={jest.fn()} />);

    const pills = UNSAFE_getAllByType(GlassPill);
    expect(pills).toHaveLength(3);
    const selectedPills = pills.filter((pill) => pill.props.selected === true);
    expect(selectedPills).toHaveLength(1);
    expect(selectedPills[0]?.props.testID).toBe('trade-tab-sell');
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
