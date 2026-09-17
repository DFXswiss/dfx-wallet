import { useId, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Card, Radius, useColors, useResolvedScheme } from '@/theme';

type GlassVariant = 'quiet' | 'default' | 'lead';

type Props = {
  variant?: GlassVariant;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Measured CSS recipe mapped onto SVG user-space. CSS 0deg is "to top";
 * SVG y grows down, so x = sin(θ), y = −cos(θ) around the box centre.
 * 158° inner glow, 152° edge.
 */
const GLOW_GRADIENT = {
  x1: '31.270%',
  y1: '3.641%',
  x2: '68.730%',
  y2: '96.359%',
} as const;
const EDGE_GRADIENT = {
  x1: '26.526%',
  y1: '5.853%',
  x2: '73.474%',
  y2: '94.147%',
} as const;

/**
 * Recipe blur is 30px. expo-blur `intensity` is 1–100, not CSS pixels:
 * web maps `blur(min(intensity,100) * 0.2px)` (expo-blur BlurView.web.tsx),
 * so 30px would be 150 and is clamped to 100 → 20px. iOS uses
 * `UIViewPropertyAnimator.fractionComplete` of `UIBlurEffect(dark)` — a
 * material, not a gaussian radius. 100 is the closest available match.
 * Android dimezis radius is `intensity / blurReductionFactor`; 100/30
 * yields the 30px recipe radius. saturate(1.45) and brightness(74%) are
 * not BlurView APIs — `tint="dark"` plus the navy overlay stand in.
 */
const BLUR_INTENSITY = 100;
const RECIPE_BLUR_PX = 30;
const ANDROID_BLUR_REDUCTION = BLUR_INTENSITY / RECIPE_BLUR_PX;

function overlayFor(variant: GlassVariant): string {
  switch (variant) {
    case 'quiet':
      return 'rgba(11,30,54,0.26)';
    case 'lead':
      return 'rgba(11,30,54,0.44)';
    case 'default':
      return 'rgba(11,30,54,0.38)';
  }
}

export function GlassSurface({ variant = 'default', radius = Radius.lg, style, children }: Props) {
  const colors = useColors();
  const scheme = useResolvedScheme();
  const isDark = scheme === 'dark';
  const overlay = overlayFor(variant);
  const rawId = useId();
  const uid = rawId.replace(/[^A-Za-z0-9]/g, '') || 'gs';
  const [box, setBox] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const strokeInset = Card.borderWidth / 2;
  const strokeRx = Math.max(0, radius - strokeInset);

  return (
    <View
      style={[
        isDark
          ? styles.darkShadow
          : {
              shadowColor: colors.shadow,
              shadowOpacity: 0.07,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 },
              elevation: 2,
            },
        { borderRadius: radius },
        !isDark && {
          backgroundColor: colors.cardOverlay,
          borderWidth: Card.borderWidth,
          borderColor: colors.cardOverlayBorder,
        },
        style,
      ]}
      onLayout={onLayout}
    >
      {isDark ? (
        <View pointerEvents="none" style={[styles.clip, { borderRadius: radius }]}>
          <BlurView
            intensity={BLUR_INTENSITY}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            blurReductionFactor={ANDROID_BLUR_REDUCTION}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
          {box.width > 0 && box.height > 0 ? (
            <Svg
              width={box.width}
              height={box.height}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id={`gs-glow-${uid}`} {...GLOW_GRADIENT}>
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.11" />
                  <Stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.02" />
                </LinearGradient>
                <LinearGradient id={`gs-edge-${uid}`} {...EDGE_GRADIENT}>
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.40" />
                  <Stop offset="34%" stopColor="#FFFFFF" stopOpacity="0.07" />
                  <Stop offset="66%" stopColor="#FFFFFF" stopOpacity="0.02" />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.17" />
                </LinearGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={box.width}
                height={box.height}
                rx={radius}
                fill={`url(#gs-glow-${uid})`}
              />
              <Rect
                x={strokeInset}
                y={strokeInset}
                width={box.width - Card.borderWidth}
                height={box.height - Card.borderWidth}
                rx={strokeRx}
                fill="none"
                stroke={`url(#gs-edge-${uid})`}
                strokeWidth={Card.borderWidth}
              />
            </Svg>
          ) : null}
          <View style={styles.insetEdge} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  insetEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Card.borderWidth,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  darkShadow: {
    shadowColor: 'rgb(2, 10, 22)',
    shadowOpacity: 0.46,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
});
