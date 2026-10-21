#!/usr/bin/env node
/**
 * Per-file coverage floor gate (Tier-A).
 *
 * Complements scripts/check-coverage-floor.mjs: that one guards the *aggregate*
 * scoped line coverage, which lets any single file rot to near-zero as long as
 * the mean stays high. This one pins individual security-critical files (key
 * derivation, seed/wallet setup, signing, auth, secure storage, biometric,
 * hardware-wallet bridge) to their own minimum in `.coverage-floors.json`.
 *
 * Fail-closed in every direction:
 *  - unreadable/invalid config            -> exit 1
 *  - unreadable coverage summary          -> exit 1
 *  - a pinned file missing from coverage  -> exit 1 (it must be in
 *    `collectCoverageFrom`; a silent scope drop must not pass the gate)
 *  - any file below its floor             -> exit 1, listing every violation
 *
 * Lowering a floor is a deliberate, reviewable edit to `.coverage-floors.json`.
 *
 * Usage: node scripts/check-coverage-file-floors.mjs [path/to/coverage-summary.json]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const summaryPath = process.argv[2] ?? 'coverage/coverage-summary.json';
const configPath = '.coverage-floors.json';

function die(msg) {
  console.error(`coverage-file-floors: ${msg}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch {
  die(`cannot read ${configPath} — the per-file floor config must exist (fail-closed)`);
}

const files = config?.files;
if (!files || typeof files !== 'object' || Array.isArray(files)) {
  die(`${configPath} must contain a "files" object mapping paths to minimum line %`);
}

let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
} catch {
  die(`cannot read ${summaryPath} — did the test job produce coverage? (fail-closed)`);
}

// Index the summary by absolute path so a configured repo-relative path matches
// regardless of how the reporter wrote the key.
const byAbs = new Map();
for (const [key, value] of Object.entries(summary)) {
  if (key === 'total') continue;
  byAbs.set(resolve(key), value);
}

const violations = [];
const missing = [];

for (const [relPath, rawFloor] of Object.entries(files)) {
  const floor = Number(rawFloor);
  if (!Number.isFinite(floor) || floor < 0 || floor > 100) {
    die(`floor for "${relPath}" must be a number between 0 and 100, got ${rawFloor}`);
  }
  const entry = byAbs.get(resolve(relPath));
  if (!entry) {
    missing.push(relPath);
    continue;
  }
  const pct = entry?.lines?.pct;
  if (typeof pct !== 'number') {
    missing.push(relPath);
    continue;
  }
  if (pct < floor) {
    violations.push(`  ${relPath}: ${pct}% < floor ${floor}%`);
  }
}

if (missing.length > 0) {
  die(
    `these pinned files are absent from coverage — are they still in ` +
      `collectCoverageFrom?\n${missing.map((m) => `  ${m}`).join('\n')}`,
  );
}

if (violations.length > 0) {
  die(
    `the following Tier-A files dropped below their per-file floor:\n` +
      `${violations.join('\n')}\n` +
      `  Add tests, or — with reviewer sign-off — lower the entry in ${configPath}.`,
  );
}

console.log(
  `coverage-file-floors: all ${Object.keys(files).length} Tier-A files meet their per-file floor.`,
);
