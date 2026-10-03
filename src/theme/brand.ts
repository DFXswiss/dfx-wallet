/**
 * DFX wordmark icon-circle gradients, shared by `BrandLogo` (and any future
 * `DfxLogoLoader`-style component that draws the same mark). Identical in
 * both themes — only the wordmark lettering switches per scheme, via the
 * `logoInk` token on `ThemeColors`. The first stop of each gradient reuses
 * `colors.brandRed` instead of repeating the hex literal a second time.
 */
import type { ThemeColors } from './colors';

export type LogoGradientStop = { offset: string; stopColor: string };

export function logoGradientInner(colors: ThemeColors): readonly LogoGradientStop[] {
  return [
    { offset: '0.04', stopColor: colors.brandRed },
    { offset: '0.14', stopColor: '#C74863' },
    { offset: '0.31', stopColor: '#853B57' },
    { offset: '0.44', stopColor: '#55324E' },
    { offset: '0.55', stopColor: '#382D49' },
    { offset: '0.61', stopColor: '#2D2B47' },
  ];
}

export function logoGradientOuter(colors: ThemeColors): readonly LogoGradientStop[] {
  return [
    { offset: '0.2', stopColor: colors.brandRed },
    { offset: '1', stopColor: '#6B3753' },
  ];
}
