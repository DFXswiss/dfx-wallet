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
import { Card, Radius, useGlassRecipe, type GlassVariant } from '@/theme';

export type { GlassVariant };

type Props = {
  variant?: GlassVariant;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
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

export function GlassSurface({
  variant = 'default',
  radius = Radius.lg,
  style,
  testID,
  children,
}: Props) {
  const recipe = useGlassRecipe();
  const overlay = recipe.overlay(variant);
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
      style={[recipe.shadow, { borderRadius: radius }, style]}
      onLayout={onLayout}
      {...(testID ? { testID } : {})}
    >
      <View pointerEvents="none" style={[styles.clip, { borderRadius: radius }]}>
        <BlurView
          intensity={BLUR_INTENSITY}
          tint={recipe.tint}
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
                {recipe.glowStops.map((stop) => (
                  <Stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.stopColor}
                    stopOpacity={stop.stopOpacity}
                  />
                ))}
              </LinearGradient>
              <LinearGradient id={`gs-edge-${uid}`} {...EDGE_GRADIENT}>
                {recipe.edgeStops.map((stop) => (
                  <Stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.stopColor}
                    stopOpacity={stop.stopOpacity}
                  />
                ))}
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
        <View style={[styles.insetEdgeTop, { backgroundColor: recipe.insetTopColor }]} />
        <View style={[styles.insetEdge, { backgroundColor: recipe.insetColor }]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  insetEdgeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: Card.borderWidth,
  },
  insetEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Card.borderWidth,
  },
});
