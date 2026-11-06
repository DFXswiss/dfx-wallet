import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { AssetGlyph } from '@/features/buy-sell/AssetGlyph';
import { CurrencyGlyph } from '@/features/buy-sell/CurrencyGlyph';
import { useColors } from '@/theme';

type Props = {
  symbol: string;
  size: number;
};

/**
 * Euro mark for the transfer screens: white on the brand blue. The shared
 * `CurrencyGlyph` draws the euro amber on blue, which loses almost all
 * contrast on the dark theme.
 */
function EuroGlyph({ size }: { size: number }) {
  const colors = useColors();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={50} fill={colors.primaryDark} />
      <SvgText
        x={50}
        y={50}
        dy={4}
        fill={colors.white}
        fontSize={60}
        fontWeight="800"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        €
      </SvgText>
    </Svg>
  );
}

/**
 * The round mark for a send-screen symbol (asset or fiat unit): BTC and the
 * fiat glyphs everywhere in the transfer flow come through this one switch.
 */
export function UnitGlyph({ symbol, size }: Props) {
  switch (symbol) {
    case 'CHF':
    case 'USD':
      return <CurrencyGlyph code={symbol} size={size} />;
    case 'EUR':
      return <EuroGlyph size={size} />;
    default:
      return <AssetGlyph symbol={symbol} size={size} />;
  }
}
