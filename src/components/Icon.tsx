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
  | 'close';

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
  }
}
