import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Production dark-mode backdrop — a cinematic blue-hour alpine scene that
 * mirrors the light theme's misty-mountain hero so both themes read as the
 * same Swiss brand. It is deliberately bright and inviting (not an ominous
 * night scene): luminous peaks up top easing into a calm mid-navy valley
 * with room for UI below.
 *
 * Two soft navy scrims (top + bottom, in `baseColor`) keep the white status
 * bar, logo and the bottom action bar legible over the brighter sky, while
 * a faint all-over wash pulls the photo's hue onto the exact brand navy.
 */
export function DarkBackdrop({ baseColor }: { baseColor: string }) {
  const { width: W, height: H } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]}>
      <Image
        source={require('../../assets/dashboard-bg-dark.jpg')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Top scrim — a soft navy veil over the whole upper-content zone
              (status bar, logo, balance) so muted labels stay legible over
              the bright mist, easing to clear before the side peaks. */}
          <LinearGradient id="dfx-scrim-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={baseColor} stopOpacity="0.78" />
            <Stop offset="14%" stopColor={baseColor} stopOpacity="0.44" />
            <Stop offset="32%" stopColor={baseColor} stopOpacity="0.36" />
            <Stop offset="52%" stopColor={baseColor} stopOpacity="0" />
          </LinearGradient>
          {/* Bottom scrim — settles the valley for content + the action bar. */}
          <LinearGradient id="dfx-scrim-bottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="55%" stopColor={baseColor} stopOpacity="0" />
            <Stop offset="100%" stopColor={baseColor} stopOpacity="0.55" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#dfx-scrim-top)" />
        <Rect x="0" y="0" width={W} height={H} fill="url(#dfx-scrim-bottom)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.wash, { backgroundColor: baseColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    opacity: 0.08,
  },
});
