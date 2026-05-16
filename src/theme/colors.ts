export type ThemeColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;

  background: string;
  surface: string;
  surfaceLight: string;
  surfaceRaised: string;
  card: string;

  text: string;
  textSecondary: string;
  textTertiary: string;

  success: string;
  warning: string;
  error: string;
  info: string;

  border: string;
  borderLight: string;

  brandRed: string;

  white: string;
  black: string;
  transparent: string;

  cardOverlay: string;
  cardOverlayBorder: string;
  shadow: string;
  statusBar: 'dark' | 'light';
};

export const lightColors: ThemeColors = {
  primary: '#1E6EF7',
  primaryDark: '#0B57CF',
  primaryLight: '#E6F0FF',

  background: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceLight: '#EEF3FA',
  surfaceRaised: '#FBFCFF',
  card: '#FFFFFF',

  text: '#0B1426',
  textSecondary: '#566174',
  textTertiary: '#8D98AA',

  success: '#16A34A',
  warning: '#EAB308',
  error: '#DC2626',
  info: '#2F7CF7',

  border: '#DDE5F0',
  borderLight: '#EEF2F7',

  brandRed: '#F5516C',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  cardOverlay: 'rgba(255,255,255,0.94)',
  cardOverlayBorder: 'rgba(221,229,240,0.9)',
  shadow: '#0B1426',
  statusBar: 'dark',
};

/**
 * Interaction tokens shared across components for consistent press
 * feedback. CTAs (filled/outlined buttons) use opacity; card-rows and
 * pill controls use a surface-tone shift. Numpad-class controls use the
 * primaryLight tint to feel "lit up" on each tap.
 */
export const Interaction = {
  pressedOpacity: 0.85,
  pressedCardOpacity: 0.92,
} as const;

// Swiss-fintech dark palette — refined for production:
// - 4-step elevation scale lets cards visually "lift" from the bg via
//   surface tone alone, without competing card-borders.
// - cardOverlayBorder is a 4% white hairline (Apple HIG convention) — reads
//   as a subtle top-light edge, not as an outlined frame.
// - text scale tuned for AAA body contrast + premium-feel display weight.
// - brand red reserved for accents/error/logo. No ambient brand wash.
export const darkColors: ThemeColors = {
  primary: '#5FA8FF',
  primaryDark: '#3B82F6',
  primaryLight: 'rgba(95,168,255,0.14)',

  background: '#0B0F18',
  surface: '#141923',
  surfaceLight: '#1C222F',
  surfaceRaised: '#262D3C',
  card: '#141923',

  text: '#EEF2F8',
  textSecondary: '#9BA8BC',
  textTertiary: '#6C7A91',

  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#5FA8FF',

  border: '#202734',
  borderLight: '#171C26',

  brandRed: '#F5516C',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  cardOverlay: '#1C222F',
  cardOverlayBorder: 'rgba(255,255,255,0.04)',
  shadow: '#000000',
  statusBar: 'light',
};

// Backwards-compat alias for screens that still consume the static colour
// object directly. New code should call useColors() so it can switch to
// `darkColors` when the theme store flips. Removing this export would
// require touching ~90 unrefactored screens at once.
export const DfxColors = lightColors;
