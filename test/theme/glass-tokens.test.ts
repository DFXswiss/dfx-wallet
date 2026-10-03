/**
 * G1 (glass-as-theme) token inventory: every token this PR added to
 * `ThemeColors` must exist, as a non-empty string, in BOTH schemes — a
 * token defined only for one scheme is exactly the kind of drift the
 * move from component-local literals to theme tokens is meant to prevent.
 *
 * Imports `@/theme/colors` directly, not the `@/theme` barrel: the barrel
 * re-exports `theme/backdrop.ts`, whose module-level `require('*.jpg'/'*.png')`
 * calls this project (`unit`, see jest.config.js) has no asset transform
 * for — only `colors.ts` is under test here, and it has zero `require`s of
 * its own, so importing it directly needs no asset transform at all. Same
 * fix already applied in `layout-tokens.test.ts` for the same reason.
 */
import { darkColors, lightColors, type ThemeColors } from '@/theme/colors';

const NEW_TOKEN_KEYS: readonly (keyof ThemeColors)[] = [
  'scrimStrong',
  'scrimMedium',
  'scrimSoft',
  'logoInk',
  'buyChipBg',
  'sellChipBg',
  'swapChipBg',
  'payChipBg',
  'payChipFg',
  'sendChipBg',
  'receiveChipBg',
];

describe('G1 theme tokens exist in both schemes', () => {
  it.each(NEW_TOKEN_KEYS)('%s is a non-empty string on lightColors and darkColors', (key) => {
    expect(typeof lightColors[key]).toBe('string');
    expect((lightColors[key] as string).length).toBeGreaterThan(0);
    expect(typeof darkColors[key]).toBe('string');
    expect((darkColors[key] as string).length).toBeGreaterThan(0);
  });

  it('scrim tokens carry the documented alpha values on the shared navy base', () => {
    for (const colors of [lightColors, darkColors]) {
      expect(colors.scrimStrong).toBe('rgba(11, 20, 38, 0.45)');
      expect(colors.scrimMedium).toBe('rgba(11, 20, 38, 0.35)');
      expect(colors.scrimSoft).toBe('rgba(11, 20, 38, 0.18)');
    }
  });

  it('logoInk differs between schemes (dark-navy ink in light, light ink in dark)', () => {
    expect(lightColors.logoInk).toBe('#072440');
    expect(darkColors.logoInk).toBe('#F1F4F9');
  });
});
