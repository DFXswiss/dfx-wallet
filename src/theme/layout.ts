/**
 * Spacing, radius and tile-size scale.
 *
 * Follows the 4px grid of the DFX Design Pod (`~/design-pod/core/tokens.css`).
 * This module is the canonical source for distances, radii and icon-tile
 * sizes — screens must not invent parallel literals for the same role.
 */

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const Radius = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

// Asset-/Status-Kacheln. Das Verhältnis radius/size bleibt über alle drei
// Stufen bei rund 0.3, damit die Kacheln als eine Familie lesen.
export const IconTile = {
  sm: { size: 40, radius: Radius.sm }, // 40 / 12
  md: { size: 48, radius: Radius.md }, // 48 / 16
  lg: { size: 64, radius: Radius.lg }, // 64 / 20
} as const;

// Ein Preset für jede Listen-Row und jede Karte im Content-Bereich.
export const Card = {
  radius: Radius.md,
  padding: Spacing.base,
  gap: Spacing.md,
  borderWidth: 1,
} as const;

export const Layout = {
  screenPadding: Spacing.lg, // 20 — Content-Seitenrand
  listGap: Spacing.md, // 12 — Abstand zwischen Listen-Rows
  sectionGap: Spacing.xl, // 24 — Abstand zwischen Sektionen
} as const;

export const Header = {
  paddingHorizontal: Layout.screenPadding,
  paddingTop: Spacing.xs,
  paddingBottom: Spacing.sm,
  slotSize: IconTile.sm.size,
  slotRadius: IconTile.sm.radius,
} as const;

/**
 * Soft halo for copy that sits on the photo backdrop instead of a card.
 * Pair with `textShadowColor: colors.background`. Light theme skips this
 * — a `#F6F8FC` glow around dark type reads as a grey fringe on the photo.
 */
export const BackdropText = {
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
};
