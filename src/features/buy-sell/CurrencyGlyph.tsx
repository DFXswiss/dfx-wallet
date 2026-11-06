import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/theme';

type Props = {
  code: 'CHF' | 'EUR' | 'USD';
  size?: number;
};

export function CurrencyGlyph({ code, size = 32 }: Props) {
  const colors = useColors();
  const backgroundColor =
    code === 'CHF' ? colors.brandRed : code === 'EUR' ? colors.primaryDark : colors.success;
  const accentColor = code === 'EUR' ? colors.warning : colors.white;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={50} fill={backgroundColor} />
      {code === 'CHF' ? (
        <>
          <Rect x={39} y={22} width={22} height={56} fill={colors.white} />
          <Rect x={22} y={39} width={56} height={22} fill={colors.white} />
        </>
      ) : (
        <SvgText
          x={50}
          y={50}
          dy={4}
          fill={accentColor}
          fontSize={53}
          fontWeight="700"
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {code === 'EUR' ? '€' : '$'}
        </SvgText>
      )}
    </Svg>
  );
}
