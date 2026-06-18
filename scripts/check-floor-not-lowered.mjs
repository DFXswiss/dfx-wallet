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

const violations = [];

// 1) Aggregate floor — a single number.
const baseLines = Number((read('.floor-base/lines', '0').trim() || '0'));
const headLines = Number((read('.coverage-floor-lines', '0').trim() || '0'));
if (headLines < baseLines) {
  violations.push(`.coverage-floor-lines lowered ${baseLines} -> ${headLines}`);
}

// 2) Per-file Tier-A floors — lowering a number OR dropping a file both weaken it.
const baseFloors = parseFloors(read('.floor-base/floors.json', '{"files":{}}'));
// A Map (not a plain object) so the dynamic per-file lookup below is not a
// property-injection sink — keys come from a JSON file, so play it safe.
const headFloors = new Map(Object.entries(parseFloors(read('.coverage-floors.json', '{"files":{}}'))));
for (const [file, baseVal] of Object.entries(baseFloors)) {
  if (!headFloors.has(file)) {
    violations.push(`.coverage-floors.json dropped Tier-A file "${file}" (was ${baseVal})`);
  } else if (headFloors.get(file) < baseVal) {
    violations.push(`.coverage-floors.json lowered "${file}" ${baseVal} -> ${headFloors.get(file)}`);
  }
}

if (violations.length === 0) {
  console.log('coverage floors not lowered — ok');
  process.exit(0);
}

for (const v of violations) console.log(`floor weakened: ${v}`);

if (!hasLabel) {
  console.error(
    "::error::Coverage floor weakened without the 'coverage:lower-floor' label. " +
      'Lowering a floor (aggregate or per-file) or dropping a Tier-A file requires ' +
      'explicit reviewer sign-off via the label.',
  );
  process.exit(1);
}

console.log("floor lowered with 'coverage:lower-floor' label — allowed");
