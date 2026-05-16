import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Production dark-mode backdrop.
 *
 * Earlier iterations used a brand-red + primary-blue radial pair to
 * mimic Phantom/Trust-Wallet ambient. That tone reads as gaming/web3,
 * not as a Swiss fintech. Final design uses a single very subtle blue
 * radial sitting top-right + a deeper near-black wash at the bottom-left
 * — gives gentle directional depth without colour-wash.
 *
 * Both stops are <=10% opacity, so the backdrop reads as the base colour
 * with a hint of atmospheric perspective rather than two visible blobs.
 */
export function DarkBackdrop({ baseColor }: { baseColor: string }) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="dfx-glow-top" cx="80%" cy="0%" r="90%" fx="80%" fy="0%">
            <Stop offset="0%" stopColor="#5FA8FF" stopOpacity="0.10" />
            <Stop offset="55%" stopColor="#1F2A3F" stopOpacity="0.04" />
            <Stop offset="100%" stopColor={baseColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="dfx-glow-bottom" cx="15%" cy="100%" r="90%" fx="15%" fy="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0.20" />
            <Stop offset="100%" stopColor={baseColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#dfx-glow-top)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#dfx-glow-bottom)" />
      </Svg>
    </View>
  );
}
