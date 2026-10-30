#!/usr/bin/env node
/**
 * Feature-matrix gate.
 *
 * The README feature matrix is declared the "source of truth" for what the
 * wallet does. A source of truth nobody validates rots silently — this script
 * makes drift a CI failure instead of a doc bug. It checks:
 *
 *  1. Every file path referenced in a README table exists in the repo.
 *  2. Every EXPO_PUBLIC_ENABLE_* flag in the README exists in
 *     src/config/features.ts — and vice versa.
 *  3. Every screen under app/ (except layouts/internals) is referenced in
 *     the README, so a new screen cannot ship without a matrix row.
 *
 * No dependencies, no install step: run with plain `node`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const errors = [];
const readme = readFileSync('README.md', 'utf8');

// --- 1. Referenced paths must exist -----------------------------------------

// Backtick tokens inside table rows that look like source paths.
const tableLines = readme.split('\n').filter((l) => l.trimStart().startsWith('|'));
const tokens = new Set();
for (const line of tableLines) {
  for (const m of line.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim();
    // Path-shaped: contains a slash and a source-file extension.
    if (/\//.test(t) && /\.(tsx?|ya?ml|js|mjs)$/.test(t)) tokens.add(t);
  }
}

/** README shorthand: `(onboarding)/welcome.tsx` means app/(onboarding)/welcome.tsx,
 *  `services/pin.ts` means src/services/pin.ts, etc. */
function resolves(token) {
  const candidates = [
    token,
    `app/${token}`,
    `src/${token}`,
    `src/features/${token}`,
    `.maestro/${token}`,
  ];
  return candidates.some((c) => existsSync(c));
}

for (const t of tokens) {
  if (!resolves(t)) {
    errors.push(`README references \`${t}\` but no such file exists (checked as-is, app/, src/, src/features/, .maestro/)`);
  }
}

// --- 2. Flags in README ⟷ flags in src/config/features.ts -------------------

const featuresSrc = readFileSync('src/config/features.ts', 'utf8');
const flagsInCode = new Set(
  [...featuresSrc.matchAll(/EXPO_PUBLIC_ENABLE_([A-Z0-9_]+)/g)].map((m) => m[1]),
);
const flagsInReadme = new Set(
  [...readme.matchAll(/EXPO_PUBLIC_ENABLE_([A-Z0-9_]+)/g)].map((m) => m[1]),
);
// `EXPO_PUBLIC_ENABLE_X` is the README's generic placeholder in prose, not a flag.
flagsInReadme.delete('X');

for (const f of flagsInCode) {
  if (!flagsInReadme.has(f)) {
    errors.push(`flag EXPO_PUBLIC_ENABLE_${f} exists in src/config/features.ts but is not documented in the README matrix`);
  }
}
for (const f of flagsInReadme) {
  if (!flagsInCode.has(f)) {
    errors.push(`README documents EXPO_PUBLIC_ENABLE_${f} but src/config/features.ts does not define it`);
  }
}

// --- 3. Every screen must have a matrix reference ---------------------------

const screenFiles = execSync(
  String.raw`find app -name '*.tsx' -not -name '_layout.tsx' -not -name '+*.tsx'`,
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

// Refuse to pass vacuously: if `find` returns nothing (wrong CWD, an empty or
// renamed `app/`), the loop below never runs and the gate would report success
// while validating zero screens. Assert the gate's own precondition instead.
// (A missing `app/` makes `execSync` throw and exit non-zero — that path is
// already correct; this only covers the "exists but empty" case.)
if (screenFiles.length === 0) {
  console.error(
    'feature-matrix: found 0 screens under app/ — the gate cannot validate matrix coverage. ' +
      'This is a setup error (wrong working directory or an empty app/), not a pass.',
  );
  process.exit(1);
}

for (const f of screenFiles) {
  const short = f.replace(/^app\//, '');
  if (!readme.includes(f) && !readme.includes(short)) {
    errors.push(`screen ${f} is not referenced anywhere in the README feature matrix — add a row (or extend an existing one) before merging`);
  }
}

// --- Report ------------------------------------------------------------------

if (errors.length > 0) {
  console.error(`feature-matrix: ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(
    '\nThe README feature matrix is the source of truth for what this wallet does.' +
      '\nKeep it in sync in the same PR that changes the code.',
  );
  process.exit(1);
}
console.log(
  `feature-matrix: OK — ${tokens.size} referenced paths exist, ` +
    `${flagsInCode.size} flags in sync, ${screenFiles.length} screens all documented`,
);
