import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/theme';

type Props = {
  symbol: string;
  size?: number;
};

export function AssetGlyph({ symbol, size = 32 }: Props) {
  const colors = useColors();
  const isBitcoin = symbol === 'BTC';
  const backgroundColor = isBitcoin ? colors.warning : colors.surfaceLight;
  const symbolColor = isBitcoin ? colors.white : colors.textSecondary;
  const glyph = isBitcoin ? '₿' : symbol.slice(0, 1) || '?';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={50} fill={backgroundColor} />
      <SvgText
        x={50}
        y={50}
        dy={4}
        fill={symbolColor}
        fontSize={53}
        fontWeight="700"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {glyph}
      </SvgText>
    </Svg>
  );
}
