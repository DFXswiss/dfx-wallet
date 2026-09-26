import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useBackdropRecipe, useColors } from '@/theme';

export type ScreenBackdropVariant = 'hero' | 'content' | 'pin' | 'pay';

type Props = {
  variant?: ScreenBackdropVariant;
};

/**
 * The one screen-photo backdrop for every screen, dark or light. Replaces
 * the old `scheme === 'dark' ? <DarkBackdrop/> : <ImageBackground/>` split
 * that every screen used to copy — that split let dark and light drift
 * (`ScreenContainer` rendered nothing at all in light, `PayScreenImpl` had
 * its own light photo) with no single place to fix it. This component owns
 * both themes: one render path, a recipe object per scheme.
 */
export function ScreenBackdrop({ variant = 'content' }: Props) {
  const colors = useColors();
  const { width: W, height: H } = useWindowDimensions();
  const recipe = useBackdropRecipe();
  const photo = variant === 'pay' && recipe.payPhoto ? recipe.payPhoto : recipe.photo;
  const scrimColor = recipe.scrimColor(colors.background);
  // `content` (the default) gets the calmer veil so intro text and headings
  // stay readable. `pin` keeps its own stronger recipe. `hero` and `pay`
  // both keep the old full-stage recipe unchanged.
  const scrimTopStops =
    variant === 'pin'
      ? recipe.pinScrimTopStops
      : variant === 'content'
        ? recipe.contentScrimTopStops
        : recipe.heroScrimTopStops;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
    >
      {/* Explicit size: with absoluteFill alone the Image kept the asset's intrinsic width and cropped off-centre. */}
      <Image
        source={photo}
        style={[StyleSheet.absoluteFill, { width: W, height: H }]}
        resizeMode="cover"
      />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="dfx-backdrop-scrim-top" x1="0" y1="0" x2="0" y2="1">
            {scrimTopStops.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={scrimColor}
                stopOpacity={stop.stopOpacity}
              />
            ))}
          </LinearGradient>
          <LinearGradient id="dfx-backdrop-scrim-bottom" x1="0" y1="0" x2="0" y2="1">
            {recipe.scrimBottomStops.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={scrimColor}
                stopOpacity={stop.stopOpacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#dfx-backdrop-scrim-top)" />
        <Rect x="0" y="0" width={W} height={H} fill="url(#dfx-backdrop-scrim-bottom)" />
      </Svg>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { opacity: recipe.washOpacity, backgroundColor: scrimColor },
        ]}
      />
    </View>
  );
}
