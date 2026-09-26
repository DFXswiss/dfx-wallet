import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useBackdropRecipe, useColors } from '@/theme';

export type ScreenBackdropVariant = 'default' | 'pay' | 'pin';

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
export function ScreenBackdrop({ variant = 'default' }: Props) {
  const colors = useColors();
  const { width: W, height: H } = useWindowDimensions();
  const recipe = useBackdropRecipe();
  const photo = variant === 'pay' && recipe.payPhoto ? recipe.payPhoto : recipe.photo;
  const scrimColor = recipe.scrimColor(colors.background);
  // `pin` keeps `default`'s photo, bottom scrim and wash; only the top
  // scrim gets a stronger recipe so logo/title/PIN dots read over the photo.
  const scrimTopStops = variant === 'pin' ? recipe.pinScrimTopStops : recipe.scrimTopStops;

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
