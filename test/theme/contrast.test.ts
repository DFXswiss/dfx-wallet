import { darkColors, lightColors } from '@/theme/colors';

function luminance(hex: string): number {
  const pairs = hex.slice(1).match(/.{2}/g);
  if (!pairs) throw new Error(`Invalid hex color: ${hex}`);
  const channels = pairs
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s theme contrast', (_name, colors) => {
  it.each([
    ['warningText/background', colors.warningText, colors.background],
    ['warningText/surface', colors.warningText, colors.surface],
    ['onPrimary/primary', colors.onPrimary, colors.primary],
    ['offline banner', colors.offlineBannerText, colors.offlineBanner],
    ['textTertiary/background', colors.textTertiary, colors.background],
    ['textTertiary/surface', colors.textTertiary, colors.surface],
  ])('%s is at least WCAG AA', (_pair, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
