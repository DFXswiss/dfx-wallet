import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { useResolvedScheme } from '@/theme';

/**
 * Semantic size tokens for the wordmark across screens.
 * - `header` → top of post-auth screens (dashboard, settings).
 * - `auth`   → PIN unlock / setup screens.
 * - `hero`   → onboarding welcome (first-impression branding).
 */
export const BrandLogoSize = {
  header: 32,
  auth: 44,
  hero: 56,
} as const;

type BrandLogoSizeToken = keyof typeof BrandLogoSize;

type Props = {
  /** Use a semantic size token (preferred). Defaults to `header`. */
  size?: BrandLogoSizeToken;
  /** Escape hatch for one-off heights — prefer `size` for consistency. */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * DFX wordmark with the iconic red-gradient circles.
 *
 * Light mode → dark navy lettering (matches printed material).
 * Dark mode → light tint lettering so the brand reads against deep navy
 * backgrounds. The two overlapping circles keep their red-to-navy
 * gradient in both themes because the gradient itself carries the brand
 * signature and is recognisable on either surface.
 */
export function BrandLogo({ size = 'header', height, style }: Props) {
  const scheme = useResolvedScheme();
  const wordmarkFill = scheme === 'dark' ? '#F1F4F9' : '#072440';
  // Resolve final height: explicit prop wins; otherwise look up the size token.
  // eslint-disable-next-line security/detect-object-injection -- size is a typed BrandLogoSizeToken; lookup yields a number from a static map
  const resolvedHeight = height ?? BrandLogoSize[size];
  // Width derived from native SVG viewBox to keep the wordmark proportions.
  const width = useMemo(() => (resolvedHeight * 544) / 170, [resolvedHeight]);

  return (
    <Svg
      width={width}
      height={resolvedHeight}
      viewBox="0 0 544 170"
      fill="none"
      style={style}
      accessibilityLabel="DFX"
    >
      <Defs>
        <LinearGradient
          id="dfx-inner-circle"
          x1="122.111"
          y1="64.6777"
          x2="45.9618"
          y2="103.949"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0.04" stopColor="#F5516C" />
          <Stop offset="0.14" stopColor="#C74863" />
          <Stop offset="0.31" stopColor="#853B57" />
          <Stop offset="0.44" stopColor="#55324E" />
          <Stop offset="0.55" stopColor="#382D49" />
          <Stop offset="0.61" stopColor="#2D2B47" />
        </LinearGradient>
        <LinearGradient
          id="dfx-outer-circle"
          x1="75.8868"
          y1="50.7468"
          x2="15.2815"
          y2="122.952"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0.2" stopColor="#F5516C" />
          <Stop offset="1" stopColor="#6B3753" />
        </LinearGradient>
        <ClipPath id="dfx-clip">
          <Path d="M0 0H544V170H0z" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#dfx-clip)">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M61.5031 0H124.245C170.646 0 208.267 36.5427 208.267 84.0393C208.267 131.536 169.767 170.018 122.288 170.018H61.5031V135.504H114.046C141.825 135.504 164.541 112.789 164.541 85.009C164.541 57.2293 141.825 34.5136 114.046 34.5136H61.5031V0ZM266.25 31.5686V76.4973H338.294V108.066H266.25V170H226.906V0H355.389V31.5686H266.25ZM495.76 170L454.71 110.975L414.396 170H369.216L432.12 83.5365L372.395 0H417.072L456.183 55.1283L494.557 0H537.061L477.803 82.082L541.191 170H495.778H495.76Z"
          fill={wordmarkFill}
        />
        <Circle cx="86.1582" cy="83.4287" r="42.846" fill="url(#dfx-inner-circle)" />
        <Circle cx="47.1374" cy="85.009" r="47.137" fill="url(#dfx-outer-circle)" />
      </G>
    </Svg>
  );
}
