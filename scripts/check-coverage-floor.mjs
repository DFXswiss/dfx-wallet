#!/usr/bin/env node
/**
 * Coverage floor gate.
 *
 * Compares the scoped line coverage (see `collectCoverageFrom` in
 * jest.config.js — services + stores only) against the committed floor in
 * `.coverage-floor-lines`. Fails the build when coverage drops below the
 * floor. Fail-closed: a missing or unreadable coverage summary is an error,
 * never a pass.
 *
 * Ratchet protocol:
 * - Raising coverage? Raise the floor in the same commit.
 * - Lowering the floor requires the `coverage:lower-floor` label on the PR;
 *   CI enforces this (see the `coverage-floor-label` job in ci.yml).
 *
 * Usage: node scripts/check-coverage-floor.mjs [path/to/coverage-summary.json]
 */
import { readFileSync } from 'node:fs';

const summaryPath = process.argv[2] ?? 'coverage/coverage-summary.json';
const floorPath = '.coverage-floor-lines';

function die(msg) {
  console.error(`coverage-floor: ${msg}`);
  process.exit(1);
}

let floor;
try {
  floor = Number.parseFloat(readFileSync(floorPath, 'utf8').trim());
} catch {
  die(`cannot read ${floorPath} — the floor file must exist (fail-closed)`);
}
if (!Number.isFinite(floor) || floor < 0 || floor > 100) {
  die(`${floorPath} must contain a single number between 0 and 100`);
}

let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
} catch {
  die(`cannot read ${summaryPath} — did the test job produce coverage? (fail-closed)`);
}

const pct = summary?.total?.lines?.pct;
if (typeof pct !== 'number') {
  die(`no total.lines.pct in ${summaryPath} (fail-closed)`);
}

console.log(`coverage-floor: scoped line coverage ${pct}% (floor ${floor}%)`);

if (pct < floor) {
  die(
    `line coverage ${pct}% is below the floor of ${floor}%.\n` +
      `  Either add tests, or — with reviewer sign-off — lower ${floorPath} ` +
      `and add the 'coverage:lower-floor' label to the PR.`,
  );
}

// Ratchet hint: if actual coverage exceeds the floor by more than 2 points,
// remind (but don't fail) so floors don't rot far below reality.
if (pct - floor > 2) {
  console.log(
    `coverage-floor: note — coverage is ${(pct - floor).toFixed(1)} points above the floor; ` +
      `consider raising ${floorPath} to ${Math.floor(pct)}`,
  );
}
