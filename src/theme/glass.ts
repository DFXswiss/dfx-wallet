/**
 * Glass-surface recipe — the single source of truth for `GlassSurface`'s
 * per-scheme look (blur tint, tone overlay, inner glow, gradient edge
 * stroke, inset hairlines, shadow). Moved out of `GlassSurface.tsx` so any
 * screen or future module can read the same recipe via `useGlassRecipe()`
 * instead of `GlassSurface` owning the only copy — a change here reaches
 * every glass surface in the app without touching a single screen.
 *
 * Values are unchanged from the pre-move recipe in `GlassSurface.tsx`.
 */
import type { ViewStyle } from 'react-native';
import { darkColors, type ThemeColors } from './colors';
import { Card } from './layout';
import { useResolvedScheme } from './theme-store';

export type GlassVariant = 'quiet' | 'default' | 'lead';

/**
 * Semantic edge tint for a glass module — layered on top of `variant`, not
 * a replacement for it. `default` renders no tint at all.
 */
export type GlassTone = 'default' | 'accent' | 'warning' | 'danger' | 'success';

export type GlassGradientStop = { offset: string; stopColor: string; stopOpacity: string };

export type GlassShadowRecipe = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export type GlassRecipe = {
  tint: 'light' | 'dark';
  overlay: (variant: GlassVariant) => string;
  glowStops: readonly GlassGradientStop[];
  edgeStops: readonly GlassGradientStop[];
  /** Bottom hairline. */
  insetColor: string;
  /**
   * Top hairline — a value in the recipe, not a conditional element: dark
   * sets it fully transparent so the tree stays identical between themes
   * while only light actually shows the highlight.
   */
  insetTopColor: string;
  shadow: GlassShadowRecipe;
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

const DARK_GLASS_RECIPE: GlassRecipe = {
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
  // Dark has no top highlight — `colors.transparent` keeps the layer in the
  // tree (see `insetTopColor` above) without changing dark's appearance.
  insetTopColor: darkColors.transparent,
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
const LIGHT_GLASS_RECIPE: GlassRecipe = {
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

/** The active glass recipe for the resolved theme scheme. */
export function useGlassRecipe(): GlassRecipe {
  const scheme = useResolvedScheme();
  return scheme === 'dark' ? DARK_GLASS_RECIPE : LIGHT_GLASS_RECIPE;
}

/**
 * Tone → theme-color recipe, kept here (not in the modules) so `GlassCard`,
 * `GlassListGroup` and `GlassPill` all tint the same way from one source.
 * Colors a thin edge only — no opaque fill — matching the hand-rolled
 * `borderWidth`/`borderColor` overrides this replaces across screens.
 * `default` renders no edge at all (`undefined`, so it composes cleanly
 * into a `style` array).
 */
function toneColorFor(tone: Exclude<GlassTone, 'default'>, colors: ThemeColors): string {
  switch (tone) {
    case 'accent':
      return colors.primary;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.error;
    case 'success':
      return colors.success;
  }
}

export function glassToneEdge(
  tone: GlassTone,
  colors: ThemeColors,
): Pick<ViewStyle, 'borderWidth' | 'borderColor'> | undefined {
  if (tone === 'default') return undefined;
  return { borderWidth: Card.borderWidth + 0.5, borderColor: toneColorFor(tone, colors) };
}
