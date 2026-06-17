#!/usr/bin/env node
/**
 * Visual-baseline coverage gate.
 *
 * The visual-regression suite (docs/visual-regression.md) is only as
 * trustworthy as the set of screens it actually snapshots. A green run that
 * silently skips half the app is worse than no run — it reads as "appearance
 * verified" when it is not. This gate makes that impossible: every route under
 * app/ must be accounted for in e2e/visual-coverage.json as exactly one of
 *
 *   - baselined : has a committed PNG + a matching expectScreenToMatchBaseline()
 *   - exempt    : has a documented engineering reason it cannot be baselined
 *   - pending   : owes a baseline and carries a tracking reference
 *
 * A new screen that is none of those fails the build, the same way a new screen
 * fails check-feature-matrix.mjs if it lacks a README row. This is the
 * structural sibling of the coverage floors: it can't be satisfied by deleting
 * the failing screen's row, only by classifying it honestly.
 *
 * Checks (all fail-closed):
 *   1. Route table on disk == route table in the manifest (both directions).
 *   2. Each route's status is valid and carries its required fields.
 *   3. Every `baselines` name is referenced by an expectScreenToMatchBaseline()
 *      call AND has a committed PNG under e2e/__baselines__/.
 *   4. Every `pendingBaselines` name is referenced by a call but has NO PNG yet
 *      (it is in flight, not silently missing).
 *   5. No orphan matcher calls (a call whose name is in no manifest entry).
 *   6. No orphan PNGs (a committed baseline no manifest entry claims).
 *
 * Modes:
 *   (default)  enforce 1–6; `pending` routes are allowed but reported.
 *   --strict   additionally fail if any `pending` route or pendingBaseline
 *              remains — the final lock once the ratchet reaches 100%.
 *   --self-test  run the gate's own logic against synthetic fixtures and exit.
 *
 * No dependencies, no install step: run with plain `node`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VALID_STATUSES = new Set(['baselined', 'exempt', 'pending']);
const MIN_REASON_LEN = 20;

/** Discover every screen route under app/, mirroring check-feature-matrix.mjs. */
export function discoverRoutes() {
  return execSync(String.raw`find app -name '*.tsx' -not -name '_layout.tsx' -not -name '+*.tsx'`, {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(/^app\//, ''))
    .sort();
}

/** All names passed to expectScreenToMatchBaseline() across e2e/visual/*.test.ts. */
export function discoverMatcherNames(dir = 'e2e/visual') {
  const names = new Set();
  if (!existsSync(dir)) return names;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const src = readFileSync(`${dir}/${file}`, 'utf8');
    for (const m of src.matchAll(/expectScreenToMatchBaseline\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      names.add(m[1]);
    }
  }
  return names;
}

/** Committed baseline PNG stems under e2e/__baselines__/. */
export function discoverCommittedBaselines(dir = 'e2e/__baselines__') {
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.replace(/\.png$/, '')),
  );
}

/**
 * Pure validator — takes the manifest and the three observed sets, returns
 * { errors, stats }. Kept side-effect-free so --self-test can exercise it.
 */
export function validate(
  manifest,
  { routes, matcherNames, committedPngs },
  { strict = false } = {},
) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object' || !manifest.routes) {
    return { errors: ['manifest is missing or has no `routes` map'], stats: {} };
  }
  const exemptCategories = manifest.exemptCategories || {};
  const entries = manifest.routes;
  const manifestKeys = Object.keys(entries);

  // 1. Route table must match the manifest exactly, both directions.
  const routeSet = new Set(routes);
  for (const r of routes) {
    if (!(r in entries)) {
      errors.push(
        `screen ${r} has no entry in e2e/visual-coverage.json — classify it as baselined, exempt, or pending before merging`,
      );
    }
  }
  for (const k of manifestKeys) {
    if (!routeSet.has(k)) {
      errors.push(
        `manifest lists "${k}" but no such screen exists under app/ — remove the stale entry`,
      );
    }
  }

  // Track which names the manifest claims, for orphan detection.
  const claimedCommitted = new Set();
  const claimedPending = new Set();
  const stats = { total: routes.length, baselined: 0, exempt: 0, pending: 0, pendingBaselines: 0 };

  // 2–4. Per-entry validation.
  for (const [key, entry] of Object.entries(entries)) {
    const e = entry || {};
    if (!VALID_STATUSES.has(e.status)) {
      errors.push(`${key}: invalid status "${e.status}" (expected baselined | exempt | pending)`);
      continue;
    }

    if (e.status === 'baselined') {
      stats.baselined++;
      const baselines = Array.isArray(e.baselines) ? e.baselines : [];
      if (baselines.length === 0) {
        errors.push(`${key}: status "baselined" but no 'baselines' listed`);
      }
      for (const name of baselines) {
        claimedCommitted.add(name);
        if (!matcherNames.has(name)) {
          errors.push(
            `${key}: baseline "${name}" is not referenced by any expectScreenToMatchBaseline() call in e2e/visual/`,
          );
        }
        if (!committedPngs.has(name)) {
          errors.push(
            `${key}: baseline "${name}" has no committed PNG at e2e/__baselines__/${name}.png`,
          );
        }
      }
      for (const name of e.pendingBaselines || []) {
        stats.pendingBaselines++;
        claimedPending.add(name);
        if (!matcherNames.has(name)) {
          errors.push(
            `${key}: pendingBaseline "${name}" is not referenced by any expectScreenToMatchBaseline() call — drop it or wire up the test`,
          );
        }
        if (committedPngs.has(name)) {
          errors.push(
            `${key}: pendingBaseline "${name}" already has a committed PNG — promote it into 'baselines'`,
          );
        }
        if (strict) {
          errors.push(`${key}: pendingBaseline "${name}" still uncommitted (--strict)`);
        }
      }
    } else if (e.status === 'exempt') {
      stats.exempt++;
      if (!e.category || !(e.category in exemptCategories)) {
        errors.push(
          `${key}: exempt category "${e.category}" is not declared in manifest.exemptCategories`,
        );
      }
      if (!e.reason || e.reason.trim().length < MIN_REASON_LEN) {
        errors.push(
          `${key}: exempt entries need a reason of at least ${MIN_REASON_LEN} characters`,
        );
      }
    } else if (e.status === 'pending') {
      stats.pending++;
      if (!e.tracking || !String(e.tracking).trim()) {
        errors.push(`${key}: pending entries need a 'tracking' reference (issue/PR)`);
      }
      if (!e.reason || e.reason.trim().length < MIN_REASON_LEN) {
        errors.push(
          `${key}: pending entries need a reason of at least ${MIN_REASON_LEN} characters`,
        );
      }
      if (strict) {
        errors.push(`${key}: still pending a visual baseline (--strict)`);
      }
    }
  }

  // 5. Orphan matcher calls.
  for (const name of matcherNames) {
    if (!claimedCommitted.has(name) && !claimedPending.has(name)) {
      errors.push(
        `expectScreenToMatchBaseline('${name}') is called in e2e/visual/ but no manifest entry claims it — add it to a route's baselines`,
      );
    }
  }

  // 6. Orphan committed PNGs.
  for (const name of committedPngs) {
    if (!claimedCommitted.has(name)) {
      errors.push(
        `e2e/__baselines__/${name}.png is committed but no manifest entry claims it — remove the orphan or claim it`,
      );
    }
  }

  const baselineable = stats.baselined + stats.pending;
  stats.baselineable = baselineable;
  stats.coveragePct =
    baselineable === 0 ? 100 : Math.round((stats.baselined / baselineable) * 1000) / 10;
  return { errors, stats };
}

function loadManifest(path = 'e2e/visual-coverage.json') {
  if (!existsSync(path)) {
    console.error(`visual-coverage: ${path} not found — the manifest is required (fail-closed).`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function runSelfTest() {
  const base = {
    exemptCategories: { redirect: 'x'.repeat(MIN_REASON_LEN) },
    routes: {
      'a.tsx': { status: 'baselined', baselines: ['a'] },
      'b.tsx': { status: 'exempt', category: 'redirect', reason: 'r'.repeat(MIN_REASON_LEN) },
      'c.tsx': { status: 'pending', tracking: '#1', reason: 'r'.repeat(MIN_REASON_LEN) },
    },
  };
  const obs = {
    routes: ['a.tsx', 'b.tsx', 'c.tsx'],
    matcherNames: new Set(['a']),
    committedPngs: new Set(['a']),
  };

  const cases = [
    ['happy path passes', () => validate(base, obs).errors.length === 0],
    [
      'unclassified screen fails',
      () =>
        validate(base, { ...obs, routes: [...obs.routes, 'd.tsx'] }).errors.some((e) =>
          e.includes('d.tsx'),
        ),
    ],
    [
      'stale manifest entry fails',
      () =>
        validate(base, { ...obs, routes: ['a.tsx', 'b.tsx'] }).errors.some((e) =>
          e.includes('c.tsx'),
        ),
    ],
    [
      'baseline without PNG fails',
      () =>
        validate(base, { ...obs, committedPngs: new Set() }).errors.some((e) =>
          e.includes('no committed PNG'),
        ),
    ],
    [
      'baseline without matcher fails',
      () =>
        validate(base, { ...obs, matcherNames: new Set() }).errors.some((e) =>
          e.includes('not referenced'),
        ),
    ],
    [
      'orphan PNG fails',
      () =>
        validate(base, { ...obs, committedPngs: new Set(['a', 'ghost']) }).errors.some((e) =>
          e.includes('ghost'),
        ),
    ],
    [
      'orphan matcher call fails',
      () =>
        validate(base, { ...obs, matcherNames: new Set(['a', 'stray']) }).errors.some((e) =>
          e.includes('stray'),
        ),
    ],
    [
      'bad exempt category fails',
      () =>
        validate(
          {
            ...base,
            routes: {
              ...base.routes,
              'b.tsx': { status: 'exempt', category: 'nope', reason: 'r'.repeat(MIN_REASON_LEN) },
            },
          },
          obs,
        ).errors.some((e) => e.includes('not declared')),
    ],
    [
      'short reason fails',
      () =>
        validate(
          {
            ...base,
            routes: {
              ...base.routes,
              'b.tsx': { status: 'exempt', category: 'redirect', reason: 'too short' },
            },
          },
          obs,
        ).errors.some((e) => e.includes('at least')),
    ],
    [
      'pending without tracking fails',
      () =>
        validate(
          {
            ...base,
            routes: {
              ...base.routes,
              'c.tsx': { status: 'pending', reason: 'r'.repeat(MIN_REASON_LEN) },
            },
          },
          obs,
        ).errors.some((e) => e.includes('tracking')),
    ],
    [
      'invalid status fails',
      () =>
        validate(
          { ...base, routes: { ...base.routes, 'a.tsx': { status: 'whoops' } } },
          obs,
        ).errors.some((e) => e.includes('invalid status')),
    ],
    [
      'strict fails on pending',
      () => validate(base, obs, { strict: true }).errors.some((e) => e.includes('--strict')),
    ],
    ['coverage math', () => validate(base, obs).stats.coveragePct === 50],
  ];

  let failed = 0;
  for (const [label, fn] of cases) {
    let ok = false;
    try {
      ok = fn();
    } catch (err) {
      ok = false;
    }
    if (!ok) {
      failed++;
      console.error(`  ✗ self-test: ${label}`);
    }
  }
  if (failed > 0) {
    console.error(`visual-coverage --self-test: ${failed}/${cases.length} case(s) failed`);
    process.exit(1);
  }
  console.log(`visual-coverage --self-test: OK — ${cases.length} cases passed`);
  process.exit(0);
}

function main() {
  const strict = process.argv.includes('--strict');
  if (process.argv.includes('--self-test')) return runSelfTest();

  const manifest = loadManifest();
  const observed = {
    routes: discoverRoutes(),
    matcherNames: discoverMatcherNames(),
    committedPngs: discoverCommittedBaselines(),
  };
  const { errors, stats } = validate(manifest, observed, { strict });

  if (errors.length > 0) {
    console.error(`visual-coverage: ${errors.length} problem(s):\n`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error(
      '\nEvery screen under app/ must be classified in e2e/visual-coverage.json.' +
        '\nSee docs/visual-regression.md "Baseline coverage gate".',
    );
    process.exit(1);
  }

  console.log(
    `visual-coverage: OK — ${stats.total} routes (` +
      `${stats.baselined} baselined, ${stats.exempt} exempt, ${stats.pending} pending). ` +
      `Baseline coverage of baselineable screens: ${stats.baselined}/${stats.baselineable} = ${stats.coveragePct}%` +
      (stats.pendingBaselines ? `, ${stats.pendingBaselines} pendingBaseline(s) in flight` : '') +
      (strict ? ' [strict]' : ''),
  );
}

// Only run main() when executed directly, so tests can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
