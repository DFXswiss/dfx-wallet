/**
 * Guards the files converted onto the layout-token scale: a missing path
 * must fail the suite (stale list), and a raw `borderRadius: 12` must fail
 * (the screen invented a radius instead of using Radius / Card / IconTile).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { darkColors } from '@/theme/colors';

const CONVERTED_FILES = [
  'src/theme/layout.ts',
  'src/components/AppHeader.tsx',
  'src/components/AssetActions.tsx',
  'src/components/AssetListItem.tsx',
  'src/components/EmptyState.tsx',
  'src/components/Skeleton.tsx',
  'src/features/portfolio/PortfolioScreenImpl.tsx',
  'src/features/portfolio/PortfolioAssetDetailScreenImpl.tsx',
] as const;

const NAKED_BORDER_RADIUS = /borderRadius\s*:\s*\d+/;

describe('layout tokens', () => {
  it('lists every converted file and forbids naked borderRadius literals', () => {
    expect(CONVERTED_FILES.length).toBeGreaterThan(0);
    for (const rel of CONVERTED_FILES) {
      const abs = join(process.cwd(), rel);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is a literal from CONVERTED_FILES
      expect({ file: rel, exists: existsSync(abs) }).toEqual({ file: rel, exists: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is a literal from CONVERTED_FILES
      const src = readFileSync(abs, 'utf8');
      expect(src).not.toMatch(NAKED_BORDER_RADIUS);
    }
  });
});

describe('dark card overlay', () => {
  it('is opaque (no rgba alpha) so cards do not pick up the photo backdrop', () => {
    expect(darkColors.cardOverlay.includes('rgba(')).toBe(false);
  });
});
