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

// Dark palette tuned like top crypto wallets (Phantom, Coinbase, Trust):
// layered surface tones for depth, lighter borders so cards "float", and
// a brighter cardOverlay so glass-style elements remain visible against
// the deepest background.
export const darkColors: ThemeColors = {
  primary: '#60A5FA',
  primaryDark: '#3B82F6',
  primaryLight: 'rgba(96,165,250,0.16)',

  background: '#070B14',
  surface: '#101728',
  surfaceLight: '#172238',
  surfaceRaised: '#1E2A45',
  card: '#101728',

  text: '#F1F4F9',
  textSecondary: '#B0BCD0',
  textTertiary: '#7F8DA6',

  success: '#22C55E',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  border: '#243250',
  borderLight: '#1A2542',

  brandRed: '#FB7185',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Fully opaque card surface — the ambient glow paints the bg, the
  // cards block that paint to read as crisp raised surfaces. Border is a
  // bright hairline that catches the ambient light.
  cardOverlay: '#1B2640',
  cardOverlayBorder: 'rgba(124,150,196,0.55)',
  shadow: '#000000',
  statusBar: 'light',
};

// Backwards-compat alias for screens that still consume the static colour
// object directly. New code should call useColors() so it can switch to
// `darkColors` when the theme store flips. Removing this export would
// require touching ~90 unrefactored screens at once.
export const DfxColors = lightColors;
