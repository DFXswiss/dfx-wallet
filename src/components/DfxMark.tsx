import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { logoGradientInner, logoGradientOuter, useColors } from '@/theme';

type Props = {
  size?: number;
  color?: string;
};

const D_PATH =
  'M61.5031 0H124.245C170.646 0 208.267 36.5427 208.267 84.0393C208.267 131.536 169.767 170.018 122.288 170.018H61.5031V135.504H114.046C141.825 135.504 164.541 112.789 164.541 85.009C164.541 57.2293 141.825 34.5136 114.046 34.5136H61.5031V0Z';

export function DfxMark({ size = 24, color }: Props) {
  const colors = useColors();
  const innerStops = logoGradientInner(colors);
  const outerStops = logoGradientOuter(colors);
  const id = useId().replace(/[^A-Za-z0-9]/g, '') || 'dfx-mark';

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 -19.1335 208.267 208.267"
      fill="none"
      accessibilityLabel="DFX"
    >
      <Defs>
        <LinearGradient
          id={`${id}-inner`}
          x1="122.111"
          y1="64.6777"
          x2="45.9618"
          y2="103.949"
          gradientUnits="userSpaceOnUse"
        >
          {innerStops.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.stopColor} />
          ))}
        </LinearGradient>
        <LinearGradient
          id={`${id}-outer`}
          x1="75.8868"
          y1="50.7468"
          x2="15.2815"
          y2="122.952"
          gradientUnits="userSpaceOnUse"
        >
          {outerStops.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.stopColor} />
          ))}
        </LinearGradient>
      </Defs>
      <Path fillRule="evenodd" clipRule="evenodd" d={D_PATH} fill={color ?? colors.logoInk} />
      <Circle cx="86.1582" cy="83.4287" r="42.846" fill={`url(#${id}-inner)`} />
      <Circle cx="47.1374" cy="85.009" r="47.137" fill={`url(#${id}-outer)`} />
    </Svg>
  );
}
