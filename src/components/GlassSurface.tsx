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
import { Card, Radius, useResolvedScheme } from '@/theme';

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

type GradientStop = { offset: string; stopColor: string; stopOpacity: string };

type ShadowRecipe = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

/**
 * Per-scheme glass recipe: same layer structure (blur tint, tone overlay,
 * inner glow, gradient edge stroke, inset hairline, shadow), different
 * values. One render path below consumes whichever recipe is active.
 */
type GlassRecipe = {
  tint: 'light' | 'dark';
  overlay: (variant: GlassVariant) => string;
  glowStops: readonly GradientStop[];
  edgeStops: readonly GradientStop[];
  /** Bottom hairline. */
  insetColor: string;
  /**
   * Top hairline — a value in the recipe, not a conditional element: dark
   * sets it fully transparent so the tree stays identical between themes
   * while only light actually shows the highlight.
   */
  insetTopColor: string;
  shadow: ShadowRecipe;
};

function darkOverlay(variant: GlassVariant): string {
  switch (variant) {
    case 'quiet':
      return 'rgba(11,30,54,0.26)';
    case 'lead':
      return 'rgba(11,30,54,0.44)';
    case 'default':
      return 'rgba(11,30,54,0.38)';
  }
}

function lightOverlay(variant: GlassVariant): string {
  switch (variant) {
    case 'quiet':
      return 'rgba(255,255,255,0.18)';
    case 'lead':
      return 'rgba(255,255,255,0.32)';
    case 'default':
      return 'rgba(255,255,255,0.24)';
  }
}

const DARK_RECIPE: GlassRecipe = {
  tint: 'dark',
  overlay: darkOverlay,
  glowStops: [
    { offset: '0%', stopColor: '#FFFFFF', stopOpacity: '0.11' },
    { offset: '46%', stopColor: '#FFFFFF', stopOpacity: '0.02' },
  ],
  edgeStops: [
    { offset: '0%', stopColor: '#FFFFFF', stopOpacity: '0.40' },
    { offset: '34%', stopColor: '#FFFFFF', stopOpacity: '0.07' },
    { offset: '66%', stopColor: '#FFFFFF', stopOpacity: '0.02' },
    { offset: '100%', stopColor: '#FFFFFF', stopOpacity: '0.17' },
  ],
  insetColor: 'rgba(0,0,0,0.30)',
  // Dark has no top highlight — transparent keeps the layer in the tree
  // (see `insetTopColor` above) without changing dark's appearance.
  insetTopColor: 'transparent',
  shadow: {
    shadowColor: 'rgb(2, 10, 22)',
    shadowOpacity: 0.46,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
};

// Light glass, "Stufe 2" — measured against JK's browser mock, mirroring
// the dark recipe's layer structure (blur tint, tone overlay, inner glow,
// gradient edge stroke, top + bottom hairline, shadow) with light-tuned
// values.
const LIGHT_RECIPE: GlassRecipe = {
  tint: 'light',
  overlay: lightOverlay,
  glowStops: [
    { offset: '0%', stopColor: '#FFFFFF', stopOpacity: '0.60' },
    { offset: '52%', stopColor: '#FFFFFF', stopOpacity: '0.04' },
  ],
  edgeStops: [
    { offset: '0%', stopColor: '#FFFFFF', stopOpacity: '1.0' },
    { offset: '30%', stopColor: '#FFFFFF', stopOpacity: '0.55' },
    { offset: '66%', stopColor: '#FFFFFF', stopOpacity: '0.18' },
    { offset: '100%', stopColor: '#072440', stopOpacity: '0.16' },
  ],
  insetColor: 'rgba(7,36,64,0.10)',
  insetTopColor: 'rgba(255,255,255,0.85)',
  shadow: {
    shadowColor: '#072440',
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
};

export function GlassSurface({ variant = 'default', radius = Radius.lg, style, children }: Props) {
  const scheme = useResolvedScheme();
  const isDark = scheme === 'dark';
  const recipe = isDark ? DARK_RECIPE : LIGHT_RECIPE;
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
    <View style={[recipe.shadow, { borderRadius: radius }, style]} onLayout={onLayout}>
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
