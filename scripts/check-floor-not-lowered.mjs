#!/usr/bin/env node
// Guards BOTH coverage floors against a silent lowering:
//   - .coverage-floor-lines   (aggregate floor, a single number)
//   - .coverage-floors.json   (per-file Tier-A floors, a path -> number map)
//
// A floor may only decrease when the PR carries the `coverage:lower-floor`
// label, which forces an explicit, reviewable decision. Dropping a file from
// the per-file map weakens the gate just as much as lowering its number, so
// that counts as a decrease too.
//
// The base versions are read from the merge-base (set up by the CI step into
// .floor-base/) rather than the base-branch tip: a floor the base raised after
// this PR forked must not be mistaken for a decrease here.
import { readFileSync } from 'node:fs';

const hasLabel = process.env.HAS_LABEL === 'true';

const read = (path, fallback) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return fallback;
  }
};

const parseFloors = (raw) => {
  try {
    return JSON.parse(raw).files ?? {};
  } catch {
    return {};
  }
};

/** Parse a floor value to a finite number, or null if it is not one. */
const toFloor = (value) => {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
};

// A non-numeric floor is corruption, not an intentional change: it must HARD
// FAIL regardless of the label. NaN comparisons are always false, so trusting
// `Number(...)` blindly would silently disable the gate — the exact "the gate
// quietly stops asserting" failure this whole PR exists to prevent.
const corruptions = [];
// Lowering a floor (or dropping a Tier-A file) is intentional and may proceed
// only with the `coverage:lower-floor` label.
const weakenings = [];

// 1) Aggregate floor — a single number.
const baseLines = toFloor(read('.floor-base/lines', '0')) ?? 0;
const headLines = toFloor(read('.coverage-floor-lines', '0'));
if (headLines === null) {
  corruptions.push('.coverage-floor-lines is not a number');
} else if (headLines < baseLines) {
  weakenings.push(`.coverage-floor-lines lowered ${baseLines} -> ${headLines}`);
}

// 2) Per-file Tier-A floors — lowering a number OR dropping a file both weaken it.
const baseFloors = parseFloors(read('.floor-base/floors.json', '{"files":{}}'));
// A Map (not a plain object) so the dynamic per-file lookup below is not a
// property-injection sink — keys come from a JSON file, so play it safe.
const headFloors = new Map(Object.entries(parseFloors(read('.coverage-floors.json', '{"files":{}}'))));
for (const [file, baseVal] of Object.entries(baseFloors)) {
  if (!headFloors.has(file)) {
    weakenings.push(`.coverage-floors.json dropped Tier-A file "${file}" (was ${baseVal})`);
    continue;
  }
  const headVal = toFloor(headFloors.get(file));
  if (headVal === null) {
    corruptions.push(`.coverage-floors.json floor for "${file}" is not a number`);
  } else if (headVal < baseVal) {
    weakenings.push(`.coverage-floors.json lowered "${file}" ${baseVal} -> ${headVal}`);
  }
}

if (corruptions.length > 0) {
  for (const c of corruptions) console.log(`floor corrupted: ${c}`);
  console.error(
    '::error::A coverage floor value is not a number — refusing to evaluate a corrupted ' +
      'floor file. This fails closed and cannot be bypassed with the label.',
  );
  process.exit(1);
}

if (weakenings.length === 0) {
  console.log('coverage floors not lowered — ok');
  process.exit(0);
}

for (const w of weakenings) console.log(`floor weakened: ${w}`);

if (!hasLabel) {
  console.error(
    "::error::Coverage floor weakened without the 'coverage:lower-floor' label. " +
      'Lowering a floor (aggregate or per-file) or dropping a Tier-A file requires ' +
      'explicit reviewer sign-off via the label.',
  );
  process.exit(1);
}

console.log("floor lowered with 'coverage:lower-floor' label — allowed");
