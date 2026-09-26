import {
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useColors, useResolvedScheme } from '@/theme';

export type ScreenBackdropVariant = 'default' | 'pay';

type Props = {
  variant?: ScreenBackdropVariant;
};

type GradientStop = { offset: string; stopOpacity: string };

/**
 * Per-scheme backdrop recipe: same four layers always render in the same
 * order (base fill → photo → top scrim → bottom scrim → wash), only the
 * values differ. "No scrim/wash" is a recipe with opacity 0, never a
 * skipped layer — that is what keeps light and dark provably the same
 * tree instead of two hand-maintained branches.
 */
type BackdropRecipe = {
  /** Default photo. Also stands in for the `pay` variant when `payPhoto`
   *  is not set (dark never swaps its photo for Pay). */
  photo: ImageSourcePropType;
  /** Overrides `photo` for `variant="pay"`. */
  payPhoto?: ImageSourcePropType;
  /** Resolves the shared scrim/wash color from the theme's `background`. */
  scrimColor: (baseColor: string) => string;
  scrimTopStops: readonly GradientStop[];
  scrimBottomStops: readonly GradientStop[];
  washOpacity: number;
};

/**
 * Dark recipe — the same values as `DarkBackdrop`: a cinematic
 * blue-hour alpine photo, deliberately bright and inviting rather than an
 * ominous night scene. Two soft navy scrims (top: status bar/logo/balance,
 * bottom: content/action bar) keep those layers legible over the brighter
 * sky, and a faint all-over wash pulls the photo's hue onto the exact
 * brand navy. `variant` never changes the dark photo — Pay's scan cutout
 * reads fine over the same mountain scene.
 */
const DARK_RECIPE: BackdropRecipe = {
  photo: require('../../assets/dashboard-bg-dark.jpg'),
  scrimColor: (baseColor) => baseColor,
  scrimTopStops: [
    { offset: '0%', stopOpacity: '0.78' },
    { offset: '14%', stopOpacity: '0.44' },
    { offset: '32%', stopOpacity: '0.36' },
    { offset: '52%', stopOpacity: '0' },
  ],
  scrimBottomStops: [
    { offset: '55%', stopOpacity: '0' },
    { offset: '100%', stopOpacity: '0.55' },
  ],
  washOpacity: 0.08,
};

/**
 * Light recipe — the Swiss misty-mountain photo, bright enough on its own
 * that it needs only a soft white veil over the status bar/logo/balance
 * zone; no bottom scrim, no wash. `payPhoto` swaps in Pay's scan-screen
 * photo; every other layer is identical to the default variant.
 */
const LIGHT_RECIPE: BackdropRecipe = {
  photo: require('../../assets/dashboard-bg-light.jpg'),
  payPhoto: require('../../assets/pay-bg.png'),
  scrimColor: () => '#FFFFFF',
  scrimTopStops: [
    { offset: '0%', stopOpacity: '0.30' },
    { offset: '18%', stopOpacity: '0.12' },
    { offset: '32%', stopOpacity: '0' },
  ],
  scrimBottomStops: [
    { offset: '0%', stopOpacity: '0' },
    { offset: '100%', stopOpacity: '0' },
  ],
  washOpacity: 0,
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
  const scheme = useResolvedScheme();
  const { width: W, height: H } = useWindowDimensions();
  const recipe = scheme === 'dark' ? DARK_RECIPE : LIGHT_RECIPE;
  const photo = variant === 'pay' && recipe.payPhoto ? recipe.payPhoto : recipe.photo;
  const scrimColor = recipe.scrimColor(colors.background);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
    >
      <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="dfx-backdrop-scrim-top" x1="0" y1="0" x2="0" y2="1">
            {recipe.scrimTopStops.map((stop) => (
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
