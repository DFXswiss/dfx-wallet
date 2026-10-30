/**
 * MonospaceFontFamily is chosen at import time, and the unit project maps
 * `react-native` to an empty module. Stub Platform, set the OS, then import
 * fresh via jest.isolateModules — same shape as test/services/platform.test.ts.
 * select mirrors React Native: the platform key wins, otherwise default.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

// Whole file, not one line: `\s` includes newlines. Optional quotes cover
// "fontFamily" and 'fontFamily'. The value quotes include backticks.
const MONOSPACE_LITERAL = /['"]?fontFamily['"]?\s*:\s*['"`]monospace['"`]/g;

function hitsInText(file: string, text: string): string[] {
  const hits: string[] = [];
  MONOSPACE_LITERAL.lastIndex = 0;
  for (const match of text.matchAll(MONOSPACE_LITERAL)) {
    const start = match.index ?? 0;
    const line = text.slice(0, start).split('\n').length;
    hits.push(`${file}:${line}`);
  }
  return hits;
}

function loadMonospaceFontFamily(): string | undefined {
  let loaded: string | undefined;
  jest.isolateModules(() => {
    loaded =
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a synchronous require to re-evaluate Platform.select
      (require('../../src/theme/typography') as { MonospaceFontFamily: string | undefined })
        .MonospaceFontFamily;
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
    const text = readFileSync(file, 'utf8');
    hits.push(...hitsInText(file, text));
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

describe('MONOSPACE_LITERAL', () => {
  it.each([
    ['a backtick template', 'fontFamily: `monospace`'],
    ['a line break between property and value', "fontFamily:\n  'monospace'"],
    ['a double-quoted key', `"fontFamily": 'monospace'`],
    ['a single-quoted key', `'fontFamily': "monospace"`],
  ])('matches %s and names file and line', (_label, sample) => {
    expect(hitsInText('sample.tsx', sample)).toEqual(['sample.tsx:1']);
  });

  it('names the line the property starts on when the value is on the next line', () => {
    const text = "export const styles = {\n  fontFamily:\n    'monospace',\n};\n";
    expect(hitsInText('src/example.tsx', text)).toEqual(['src/example.tsx:2']);
  });

  it('does not match the token expression', () => {
    expect(hitsInText('sample.tsx', 'fontFamily: MonospaceFontFamily')).toEqual([]);
  });

  it('does not match the word monospace in a comment', () => {
    expect(hitsInText('sample.tsx', '// Menlo is the iOS monospace face')).toEqual([]);
  });
});

describe('monospace fontFamily literals', () => {
  it('has none under app/ or src/', () => {
    expect([...literalHits('app'), ...literalHits('src')]).toEqual([]);
  });
});
