/**
 * Screen-backdrop recipe — the single source of truth for `ScreenBackdrop`'s
 * per-scheme photo, scrim gradients and wash. Moved out of
 * `ScreenBackdrop.tsx` for the same reason as `theme/glass.ts`: one place
 * to change the recipe instead of a component-local constant.
 *
 * `heroScrimTopStops` and `pinScrimTopStops` are unchanged from the pre-move
 * recipe; `contentScrimTopStops` is new (content screens' default veil).
 */
import type { ImageSourcePropType } from 'react-native';
import { lightColors } from './colors';
import { useResolvedScheme } from './theme-store';

export type BackdropGradientStop = { offset: string; stopOpacity: string };

export type BackdropRecipe = {
  /** Default photo. Also stands in for the `pay` variant when `payPhoto`
   *  is not set (dark never swaps its photo for Pay). */
  photo: ImageSourcePropType;
  /** Overrides `photo` for `variant="pay"`. */
  payPhoto?: ImageSourcePropType;
  /** Resolves the shared scrim/wash color from the theme's `background`. */
  scrimColor: (baseColor: string) => string;
  /** Top scrim for `variant="hero"` (full-stage recipe, Dashboard only) and
   *  `variant="pay"` (pay keeps this recipe unchanged, not `content`'s). */
  heroScrimTopStops: readonly BackdropGradientStop[];
  /** Top scrim for `variant="content"` (the default): a calmer veil over the
   *  upper area so intro text, section headings and amounts stay readable
   *  on top of the photo, while the peak keeps a soft silhouette. */
  contentScrimTopStops: readonly BackdropGradientStop[];
  /** Overrides the top scrim for `variant="pin"`: a stronger scrim that
   *  calms the top ~55% of the photo behind logo, title and PIN dots.
   *  Same photo, bottom scrim and wash as the other variants. */
  pinScrimTopStops: readonly BackdropGradientStop[];
  scrimBottomStops: readonly BackdropGradientStop[];
  washOpacity: number;
};

/**
 * Dark recipe — a cinematic blue-hour alpine photo, deliberately bright and
 * inviting rather than an ominous night scene. Two soft navy scrims (top:
 * status bar/logo/balance, bottom: content/action bar) keep those layers
 * legible over the brighter sky, and a faint all-over wash pulls the
 * photo's hue onto the exact brand navy. `variant` never changes the dark
 * photo — Pay's scan cutout reads fine over the same mountain scene.
 */
const DARK_BACKDROP_RECIPE: BackdropRecipe = {
  photo: require('../../assets/dashboard-bg-dark.jpg'),
  scrimColor: (baseColor) => baseColor,
  heroScrimTopStops: [
    { offset: '0%', stopOpacity: '0.78' },
    { offset: '14%', stopOpacity: '0.44' },
    { offset: '32%', stopOpacity: '0.36' },
    { offset: '52%', stopOpacity: '0' },
  ],
  contentScrimTopStops: [
    { offset: '0%', stopOpacity: '0.84' },
    { offset: '30%', stopOpacity: '0.64' },
    { offset: '48%', stopOpacity: '0.46' },
    { offset: '64%', stopOpacity: '0' },
  ],
  pinScrimTopStops: [
    { offset: '0%', stopOpacity: '0.86' },
    { offset: '30%', stopOpacity: '0.66' },
    { offset: '44%', stopOpacity: '0.50' },
    { offset: '58%', stopOpacity: '0' },
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
const LIGHT_BACKDROP_RECIPE: BackdropRecipe = {
  photo: require('../../assets/dashboard-bg-light.jpg'),
  payPhoto: require('../../assets/pay-bg.png'),
  scrimColor: () => lightColors.white,
  heroScrimTopStops: [
    { offset: '0%', stopOpacity: '0.30' },
    { offset: '18%', stopOpacity: '0.12' },
    { offset: '32%', stopOpacity: '0' },
  ],
  contentScrimTopStops: [
    { offset: '0%', stopOpacity: '0.58' },
    { offset: '30%', stopOpacity: '0.50' },
    { offset: '48%', stopOpacity: '0.34' },
    { offset: '64%', stopOpacity: '0' },
  ],
  pinScrimTopStops: [
    { offset: '0%', stopOpacity: '0.62' },
    { offset: '30%', stopOpacity: '0.52' },
    { offset: '44%', stopOpacity: '0.38' },
    { offset: '58%', stopOpacity: '0' },
  ],
  scrimBottomStops: [
    { offset: '0%', stopOpacity: '0' },
    { offset: '100%', stopOpacity: '0' },
  ],
  washOpacity: 0,
};

/** The active backdrop recipe for the resolved theme scheme. */
export function useBackdropRecipe(): BackdropRecipe {
  const scheme = useResolvedScheme();
  return scheme === 'dark' ? DARK_BACKDROP_RECIPE : LIGHT_BACKDROP_RECIPE;
}
