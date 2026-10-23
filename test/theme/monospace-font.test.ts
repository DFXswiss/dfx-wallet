/**
 * MonospaceFontFamily is chosen at import time, and the unit project maps
 * `react-native` to an empty module. Stub Platform, set the OS, then import
 * fresh via jest.isolateModules — same shape as test/services/platform.test.ts.
 * select mirrors React Native: the platform key wins, otherwise default.
 */
type FontSpec = {
  ios?: string;
  android?: string;
  native?: string;
  default?: string;
};

const platformState = { OS: 'ios' };

function selectFamily(spec: FontSpec): string | undefined {
  if (platformState.OS === 'ios') {
    if ('ios' in spec) return spec.ios;
    if ('native' in spec) return spec.native;
    return spec.default;
  }
  if (platformState.OS === 'android') {
    if ('android' in spec) return spec.android;
    if ('native' in spec) return spec.native;
    return spec.default;
  }
  if ('native' in spec) return spec.native;
  return spec.default;
}

const platformStub = {
  get OS(): string {
    return platformState.OS;
  },
  set OS(value: string) {
    platformState.OS = value;
  },
  select: selectFamily,
};
jest.mock('react-native', () => ({ Platform: platformStub }));

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MONOSPACE_LITERAL = /fontFamily\s*:\s*['"]monospace['"]/;

function loadMonospaceFontFamily(): string | undefined {
  let loaded: string | undefined;
  jest.isolateModules(() => {
    loaded = (
      require('../../src/theme/typography') as { MonospaceFontFamily: string | undefined }
    ).MonospaceFontFamily;
  });
  return loaded;
}

/** Recursively list every non-test .ts/.tsx file under a directory. */
function tsSourceFiles(dir: string): string[] {
  const out: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only walk rooted at the literal 'app' or 'src'; paths derive solely from that subtree, no external input
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...tsSourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(path);
    }
  }
  return out;
}

function literalHits(root: string): string[] {
  const hits: string[] = [];
  for (const file of tsSourceFiles(root)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- `file` comes only from the literal-rooted tsSourceFiles walk, no external input
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (MONOSPACE_LITERAL.test(line)) hits.push(`${file}:${index + 1}`);
      });
  }
  return hits;
}

describe('MonospaceFontFamily', () => {
  it('is Menlo on iOS', () => {
    platformStub.OS = 'ios';
    expect(loadMonospaceFontFamily()).toBe('Menlo');
  });

  it('is monospace on Android', () => {
    platformStub.OS = 'android';
    expect(loadMonospaceFontFamily()).toBe('monospace');
  });

  it('is re-exported next to Typography', () => {
    const src = readFileSync('src/theme/index.ts', 'utf8');
    expect(src).toContain("export { Typography, MonospaceFontFamily } from './typography';");
  });
});

describe('monospace fontFamily literals', () => {
  it('has none under app/ or src/', () => {
    expect([...literalHits('app'), ...literalHits('src')]).toEqual([]);
  });
});
