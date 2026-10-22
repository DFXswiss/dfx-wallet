import { render } from '@testing-library/react-native';
import { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { CurrencyGlyph } from '../../src/features/buy-sell/CurrencyGlyph';

const mockColors = {
  brandRed: '#F5516C',
  primaryDark: '#0B57CF',
  success: '#16A34A',
  warning: '#EAB308',
  white: '#FFFFFF',
};

jest.mock('@/theme', () => ({ useColors: () => mockColors }));

describe('CurrencyGlyph', () => {
  it('renders CHF with a Swiss-red circle and a white cross', () => {
    const { UNSAFE_getByType, UNSAFE_getAllByType, UNSAFE_queryByType } = render(
      <CurrencyGlyph code="CHF" />,
    );

    expect(UNSAFE_getByType(Circle).props.fill).toBe(mockColors.brandRed);
    expect(UNSAFE_getAllByType(Rect)).toHaveLength(2);
    expect(UNSAFE_getAllByType(Rect).every((rect) => rect.props.fill === mockColors.white)).toBe(
      true,
    );
    expect(UNSAFE_queryByType(SvgText)).toBeNull();
  });

  it.each([
    ['EUR', mockColors.primaryDark, '€', mockColors.warning],
    ['USD', mockColors.success, '$', mockColors.white],
  ] as const)('renders %s with its currency colors and symbol', (code, circleFill, symbol, fill) => {
    const { UNSAFE_getByType } = render(<CurrencyGlyph code={code} />);

    expect(UNSAFE_getByType(Circle).props.fill).toBe(circleFill);
    expect(UNSAFE_getByType(SvgText).props.fill).toBe(fill);
    expect(UNSAFE_getByType(SvgText).props.children).toBe(symbol);
  });
});
