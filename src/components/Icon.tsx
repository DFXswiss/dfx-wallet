import Svg, { Path, Polyline, Rect, Line, Circle } from 'react-native-svg';
import { DfxColors } from '@/theme';

type IconName =
  | 'menu'
  | 'eye'
  | 'eye-off'
  | 'wallet'
  | 'grid'
  | 'chevron-right'
  | 'swap'
  | 'send'
  | 'receive'
  | 'close'
  | 'lightning'
  | 'arrow-left'
  | 'user'
  | 'shield'
  | 'globe'
  | 'document'
  | 'support'
  | 'arrow-down'
  | 'arrow-up'
  | 'storefront';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = DfxColors.primary, strokeWidth = 2 }: Props) {
  const stroke = color;
  const sw = strokeWidth;

  switch (name) {
    case 'menu':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line
            x1={4}
            y1={7}
            x2={20}
            y2={7}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Line
            x1={4}
            y1={12}
            x2={20}
            y2={12}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Line
            x1={4}
            y1={17}
            x2={20}
            y2={17}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={sw} />
        </Svg>
      );
    case 'eye-off':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17.6 17.6 0 01-3.2 4.1M6.6 6.6A17.6 17.6 0 002 12s3.5 7 10 7a9.9 9.9 0 005-1.4"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'wallet':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={2.5} y={6} width={19} height={13} rx={2.5} stroke={stroke} strokeWidth={sw} />
          <Path d="M2.5 9.5h13" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx={17.5} cy={13} r={1.2} fill={stroke} />
        </Svg>
      );
    case 'grid':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={3.5} y={3.5} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={sw} />
          <Rect x={13.5} y={3.5} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={sw} />
          <Rect x={3.5} y={13.5} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={sw} />
          <Rect x={13.5} y={13.5} width={7} height={7} rx={1.5} stroke={stroke} strokeWidth={sw} />
        </Svg>
      );
    case 'chevron-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline
            points="9,5 16,12 9,19"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'swap':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M7 7h13M7 7l3-3M7 7l3 3M17 17H4M17 17l-3 3M17 17l-3-3"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'send':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 3L3 11l7 3 3 7 8-18z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'receive':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 3L3 11l7 3 3 7 8-18z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            transform="rotate(-90 12 12)"
          />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line
            x1={5}
            y1={5}
            x2={19}
            y2={19}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Line
            x1={19}
            y1={5}
            x2={5}
            y2={19}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'lightning':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={stroke}>
          <Path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </Svg>
      );
    case 'arrow-left':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 5l-7 7 7 7"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'user':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={4} stroke={stroke} strokeWidth={sw} />
          <Path
            d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5L4 5.5v6c0 4.5 3.4 8.7 8 10 4.6-1.3 8-5.5 8-10v-6l-8-3z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'globe':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={sw} />
          <Path
            d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'document':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 3h8l4 4v14H6z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M14 3v4h4" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M9 12h6M9 16h6" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'arrow-down':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4v15m0 0l-6-6m6 6l6-6"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'arrow-up':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 20V5m0 0l-6 6m6-6l6 6"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'storefront':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 9l1.5-4h15L21 9"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M3 9v11h18V9"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3M9 9c0 1.7 1.3 3 3 3s3-1.3 3-3M15 9c0 1.7 1.3 3 3 3s3-1.3 3-3"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'support':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={sw} />
          <Path
            d="M9 9.5a3 3 0 116 0c0 1.5-1.5 2-2.3 2.5-.4.3-.7.7-.7 1.3M12 17h.01"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
}
