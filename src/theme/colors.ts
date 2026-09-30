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
  /** Soft halo around a success mark (the check circle of the send flow). */
  successGlow: string;
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
  /**
   * Opaque fill for pill controls that sit on the photo backdrop
   * (Kauf/Verkauf). `primaryLight` stays the tint *inside* cards.
   */
  pillSurface: string;
  /** Hairline around `pillSurface` pills. */
  pillBorder: string;
  /**
   * Visible hairline used for in-card dividers (e.g. between two pills
   * inside a single rounded container). Tuned to read on either theme —
   * use this instead of `border` when the divider sits inside a card
   * whose surface is too close in luminance to register a standard
   * border-grey.
   */
  divider: string;
  shadow: string;
  statusBar: 'dark' | 'light';

  /**
   * Shared scrim scale for anything that dims content behind a modal or a
   * cutout (all on the brand-navy base `rgb(11, 20, 38)`). Replaces the
   * five identical `rgba(11, 20, 38, …)` literals that used to be copied
   * into each modal's stylesheet.
   */
  scrimStrong: string; // 0.45 — full-screen modal backdrops
  scrimMedium: string; // 0.35 — side-sheet backdrops (MenuModal)
  scrimSoft: string; // 0.18 — in-content cutouts (Pay QR window)

  /**
   * Wordmark ink for `BrandLogo` / `DfxLogoLoader`. The icon-circle
   * gradients themselves are scheme-invariant (see `theme/brand.ts`) — only
   * the lettering switches per scheme.
   */
  logoInk: string;

  /**
   * Transaction-type chip backgrounds (the icon-chip fill in
   * `TransactionRow`), one per `TransactionDto['type']`. Foregrounds reuse
   * `success` / `error` / `primary` directly (Buy/Receive → success,
   * Sell/Send → error, Swap → primary) since those already carry the right
   * per-scheme value; only Pay's accent has no existing analog, hence
   * `payChipFg`.
   */
  buyChipBg: string;
  sellChipBg: string;
  swapChipBg: string;
  payChipBg: string;
  payChipFg: string;
  sendChipBg: string;
  receiveChipBg: string;
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
  successGlow: 'rgba(22,163,74,0.38)',
  warning: '#EAB308',
  error: '#DC2626',
  info: '#2F7CF7',

  border: '#DDE5F0',
  borderLight: '#EEF2F7',

  brandRed: '#F5516C',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  cardOverlay: '#FFFFFF',
  cardOverlayBorder: 'rgba(221,229,240,0.9)',
  pillSurface: '#E6F0FF',
  pillBorder: 'rgba(30,110,247,0.12)',
  divider: '#DDE5F0',
  shadow: '#0B1426',
  statusBar: 'dark',

  scrimStrong: 'rgba(11, 20, 38, 0.45)',
  scrimMedium: 'rgba(11, 20, 38, 0.35)',
  scrimSoft: 'rgba(11, 20, 38, 0.18)',

  logoInk: '#072440',

  buyChipBg: '#DCFCE7',
  sellChipBg: '#FEE2E2',
  swapChipBg: '#DCEAFE',
  payChipBg: '#EDE9FE',
  payChipFg: '#7C3AED',
  sendChipBg: '#FEE2E2',
  receiveChipBg: '#DCFCE7',
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
  /** Shared dim for any disabled pressable — matches the pre-existing 0.5
   *  literal every disabled style in the app already converged on. */
  disabledOpacity: 0.5,
} as const;

// DFX brand-navy dark palette — sourced from the DFX Design Pod
// (`tokens/themes.json` → theme.dark), the same DNA as joshua.dfx.swiss.
// - base is the brand navy #0A3055 (pod navy.800), not a neutral slate —
//   the dark wallet now reads as DFX, not as a generic web3 dark mode.
// - 4-step navy elevation ramp (0A3055 → 1C5187) lets cards "lift" from
//   the bg via tone alone, without competing card-borders.
// - hairlines are white-alpha (pod convention) — a subtle top-light edge,
//   not an outlined frame.
// - text scale = pod darkText ramp (#f9fafb / #a8b5c8 / #8a99b7).
// - primary stays DFX blue (contrast-lightened for navy); brand red
//   #F5516C is reserved for accents/error/logo. No ambient brand wash.
export const darkColors: ThemeColors = {
  primary: '#5FA8FF',
  primaryDark: '#3B82F6',
  primaryLight: 'rgba(95,168,255,0.14)',

  background: '#0A3055',
  surface: '#0E3A63',
  surfaceLight: '#154573',
  surfaceRaised: '#1C5187',
  card: '#0E3A63',

  text: '#F9FAFB',
  textSecondary: '#A8B5C8',
  textTertiary: '#8A99B7',

  success: '#34D399',
  successGlow: 'rgba(52,211,153,0.42)',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#5FA8FF',

  border: 'rgba(255,255,255,0.10)',
  borderLight: 'rgba(255,255,255,0.06)',

  brandRed: '#F5516C',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  cardOverlay: '#113962',
  cardOverlayBorder: 'rgba(255,255,255,0.10)',
  pillSurface: '#154573',
  pillBorder: 'rgba(255,255,255,0.10)',
  divider: 'rgba(255,255,255,0.10)',
  shadow: '#000000',
  statusBar: 'light',

  scrimStrong: 'rgba(11, 20, 38, 0.45)',
  scrimMedium: 'rgba(11, 20, 38, 0.35)',
  scrimSoft: 'rgba(11, 20, 38, 0.18)',

  logoInk: '#F1F4F9',

  buyChipBg: 'rgba(52,211,153,0.16)',
  sellChipBg: 'rgba(248,113,113,0.16)',
  swapChipBg: 'rgba(95,168,255,0.16)',
  payChipBg: 'rgba(167,139,250,0.18)',
  payChipFg: '#A78BFA',
  sendChipBg: 'rgba(248,113,113,0.16)',
  receiveChipBg: 'rgba(52,211,153,0.16)',
};

// Backwards-compat alias for screens that still consume the static colour
// object directly. New code should call useColors() so it can switch to
// `darkColors` when the theme store flips. Removing this export would
// require touching ~90 unrefactored screens at once.
export const DfxColors = lightColors;
