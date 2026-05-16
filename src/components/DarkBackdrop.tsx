import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Ambient dark-mode backdrop with two diffused radial gradients — a soft
 * brand-red blob from the top-left, a soft primary-blue blob from the
 * bottom-right — overlaid on the deep base background.
 *
 * SVG radial gradients fade smoothly to transparent at their edges, so
 * unlike `<View borderRadius>` discs there is no visible horizon line.
 * This matches the production "ambient light" look seen in Phantom,
 * Coinbase Wallet, Trust Wallet and Rainbow.
 */
export function DarkBackdrop({ baseColor }: { baseColor: string }) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="dfx-glow-red" cx="10%" cy="-10%" r="65%" fx="10%" fy="-10%">
            <Stop offset="0%" stopColor="#F5516C" stopOpacity="0.55" />
            <Stop offset="55%" stopColor="#7A2A45" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#070B14" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="dfx-glow-blue" cx="95%" cy="105%" r="70%" fx="95%" fy="105%">
            <Stop offset="0%" stopColor="#1E6EF7" stopOpacity="0.45" />
            <Stop offset="55%" stopColor="#152C5E" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#070B14" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#dfx-glow-red)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#dfx-glow-blue)" />
      </Svg>
    </View>
  );
}
