import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

type Props = {
  code: 'CHF' | 'EUR' | 'USD';
  size?: number;
};

const CURRENCY_COLORS = {
  CHF: '#D52B1E',
  EUR: '#003399',
  USD: '#1B7A3D',
} as const;

export function CurrencyGlyph({ code, size = 32 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* eslint-disable-next-line security/detect-object-injection -- code is a typed CHF|EUR|USD union */}
      <Circle cx={50} cy={50} r={50} fill={CURRENCY_COLORS[code]} />
      {code === 'CHF' ? (
        <>
          <Rect x={39} y={22} width={22} height={56} fill="#FFFFFF" />
          <Rect x={22} y={39} width={56} height={22} fill="#FFFFFF" />
        </>
      ) : (
        <SvgText
          x={50}
          y={50}
          dy={4}
          fill={code === 'EUR' ? '#FFD700' : '#FFFFFF'}
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
