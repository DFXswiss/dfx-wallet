import { render } from '@testing-library/react-native';
import { Circle, Text as SvgText } from 'react-native-svg';
import { AssetGlyph } from '../../src/features/buy-sell/AssetGlyph';

const mockFallbackBackground = '#E8ECF2';
const mockFallbackText = '#667085';

jest.mock('@/theme', () => ({
  useColors: () => ({
    surfaceLight: '#E8ECF2',
    textSecondary: '#667085',
  }),
}));

describe('AssetGlyph', () => {
  it('renders BTC with Bitcoin orange and the white Bitcoin symbol', () => {
    const { UNSAFE_getByType } = render(<AssetGlyph symbol="BTC" />);

    expect(UNSAFE_getByType(Circle).props.fill).toBe('#F7931A');
    expect(UNSAFE_getByType(SvgText).props.fill).toBe('#FFFFFF');
    expect(UNSAFE_getByType(SvgText).props.children).toBe('₿');
  });

  it('renders an unknown asset with the theme fallback and its first letter', () => {
    const { UNSAFE_getByType } = render(<AssetGlyph symbol="WBTC" />);

    expect(UNSAFE_getByType(Circle).props.fill).toBe(mockFallbackBackground);
    expect(UNSAFE_getByType(SvgText).props.fill).toBe(mockFallbackText);
    expect(UNSAFE_getByType(SvgText).props.children).toBe('W');
  });

  it('renders a question mark when the symbol is empty', () => {
    const { UNSAFE_getByType } = render(<AssetGlyph symbol="" />);

    expect(UNSAFE_getByType(SvgText).props.children).toBe('?');
  });
});
