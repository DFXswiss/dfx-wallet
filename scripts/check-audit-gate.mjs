#!/usr/bin/env node
/**
 * Audit-gate classifier regression check.
 *
 * The live `npm audit (high+)` job embeds a Python classifier in
 * .github/workflows/ci.yml. That classifier is the merge blocker — a silent
 * drift in collect_ghsas would either let a high/critical finding through or
 * promote a below-threshold descendant into a blocker via mixed-severity
 * ancestry (the @wix-pilot/detox + stream-json case). This script extracts
 * that embedded program and runs it against synthetic npm-audit JSON fixtures.
 *
 * Modes:
 *   --self-test              run fixtures against the repository workflow
 *   --self-test --workflow P  same fixtures against an alternate YAML
 *
 * No duplicate classifier, no YAML parser, no shell, no install step.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const DEFAULT_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'ci.yml');
const CHILD_TIMEOUT_MS = 8000;
const MAX_OUTPUT = 800;

const ALLOWED_BRACES = 'GHSA-vfj7-8cjw-p6xm';
const SYN_HIGH = 'GHSA-aaaa-bbbb-cccc';
const SYN_CRITICAL = 'GHSA-dddd-eeee-ffff';
const SYN_MODERATE = 'GHSA-mmmm-nnnn-oooo';
const SYN_LOW = 'GHSA-llll-wwww-oooo';

const PASS_MARKER = 'npm audit: only allowlisted (or no) high/critical findings';
const REJECT_MARKERS = [
  'Unallowed high/critical vulnerabilities:',
  'npm audit did not produce JSON',
  'npm audit error:',
  'npm audit JSON missing vulnerabilities',
];

function dictVia(ghsa, severity) {
  const entry = { url: `https://github.com/advisories/${ghsa}` };
  if (severity !== undefined) entry.severity = severity;
  return entry;
}

function pkg(name, severity, via) {
  return { name, severity, via };
}

function report(vulnerabilities) {
  return { vulnerabilities };
}

const CASES = [
  {
    name: 'clean report pass',
    expect: 'pass',
    fixture: report({}),
  },
  {
    name: 'actual allowed high pass',
    expect: 'pass',
    fixture: report({
      braces: pkg('braces', 'high', [dictVia(ALLOWED_BRACES, 'high')]),
    }),
  },
  {
    name: 'mixed allowed high + nonallowed moderate pass',
    expect: 'pass',
    fixture: report({
      '@wix-pilot/detox': pkg('@wix-pilot/detox', 'high', ['braces', 'stream-json']),
      braces: pkg('braces', 'high', [dictVia(ALLOWED_BRACES, 'high')]),
      'stream-json': pkg('stream-json', 'moderate', [dictVia(SYN_MODERATE, 'moderate')]),
    }),
  },
  {
    name: 'mixed allowed high + low pass',
    expect: 'pass',
    fixture: report({
      '@wix-pilot/detox': pkg('@wix-pilot/detox', 'high', ['braces', 'low-dep']),
      braces: pkg('braces', 'high', [dictVia(ALLOWED_BRACES, 'high')]),
      'low-dep': pkg('low-dep', 'low', [dictVia(SYN_LOW, 'low')]),
    }),
  },
  {
    name: 'unallowed high fail',
    expect: 'reject',
    fixture: report({
      evil: pkg('evil', 'high', [dictVia(SYN_HIGH, 'high')]),
    }),
  },
  {
    name: 'unallowed critical fail',
    expect: 'reject',
    fixture: report({
      evil: pkg('evil', 'critical', [dictVia(SYN_CRITICAL, 'critical')]),
    }),
  },
  {
    name: 'allowed high + unallowed high fail',
    expect: 'reject',
    fixture: report({
      parent: pkg('parent', 'high', ['braces', 'evil']),
      braces: pkg('braces', 'high', [dictVia(ALLOWED_BRACES, 'high')]),
      evil: pkg('evil', 'high', [dictVia(SYN_HIGH, 'high')]),
    }),
  },
  {
    name: 'allowed high + unallowed critical fail',
    expect: 'reject',
    fixture: report({
      parent: pkg('parent', 'critical', ['braces', 'evil']),
      braces: pkg('braces', 'high', [dictVia(ALLOWED_BRACES, 'high')]),
      evil: pkg('evil', 'critical', [dictVia(SYN_CRITICAL, 'critical')]),
    }),
  },
  {
    name: 'known allowed plus unidentified dict advisory fail',
    expect: 'reject',
    fixture: report({
      braces: pkg('braces', 'high', [
        dictVia(ALLOWED_BRACES, 'high'),
        { title: 'unidentified advisory', severity: 'high' },
      ]),
    }),
  },
  {
    name: 'known allowed plus unresolved package-reference via fail',
    expect: 'reject',
    fixture: report({
      parent: pkg('parent', 'high', ['braces', 'missing-pkg']),
      braces: pkg('braces', 'high', [dictVia(ALLOWED_BRACES, 'high')]),
    }),
  },
  {
    name: 'unknown via type fail',
    expect: 'reject',
    fixture: report({
      braces: pkg('braces', 'high', [dictVia(ALLOWED_BRACES, 'high'), true]),
    }),
  },
  {
    name: 'cycle with allowed direct high passes',
    expect: 'pass',
    fixture: report({
      left: pkg('left', 'high', ['right', dictVia(ALLOWED_BRACES, 'high')]),
      right: pkg('right', 'high', ['left']),
    }),
  },
  {
    name: 'cycle with unallowed direct high fails',
    expect: 'reject',
    fixture: report({
      left: pkg('left', 'high', ['right', dictVia(SYN_HIGH, 'high')]),
      right: pkg('right', 'high', ['left']),
    }),
  },
  {
    name: 'error payload fail',
    expect: 'reject',
    fixture: { error: { code: 'EAUDITFAIL', summary: 'registry unavailable' } },
  },
  {
    name: 'missing vulnerabilities fail',
    expect: 'reject',
    fixture: { auditReportVersion: 2 },
  },
  {
    name: "direct moderate root doesn't block",
    expect: 'pass',
    fixture: report({
      'stream-json': pkg('stream-json', 'moderate', [dictVia(SYN_MODERATE, 'moderate')]),
    }),
  },
  {
    name: 'missing advisory severity with an unallowed GHSA still blocks',
    expect: 'reject',
    expectGhsas: [SYN_HIGH],
    fixture: report({
      mystery: pkg('mystery', 'high', [dictVia(SYN_HIGH)]),
    }),
  },
  {
    name: 'unknown advisory severity with an unallowed GHSA still blocks',
    expect: 'reject',
    expectGhsas: [SYN_HIGH],
    fixture: report({
      mystery: pkg('mystery', 'high', [dictVia(SYN_HIGH, 'unknown')]),
    }),
  },
  {
    name: 'mixed allowed high + missing-severity unallowed SYN_HIGH still blocks',
    expect: 'reject',
    expectGhsas: [SYN_HIGH],
    fixture: report({
      parent: pkg('parent', 'high', [dictVia(ALLOWED_BRACES, 'high'), dictVia(SYN_HIGH)]),
    }),
  },
  {
    name: 'mixed allowed high + unknown-severity unallowed SYN_HIGH still blocks',
    expect: 'reject',
    expectGhsas: [SYN_HIGH],
    fixture: report({
      parent: pkg('parent', 'high', [
        dictVia(ALLOWED_BRACES, 'high'),
        dictVia(SYN_HIGH, 'unknown'),
      ]),
    }),
  },
];

function parseArgs(argv) {
  let selfTest = false;
  let workflow = null;
  const args = argv.slice(2);
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--self-test') {
      selfTest = true;
      continue;
    }
    if (arg === '--workflow') {
      const value = args.shift();
      if (!value) {
        throw new Error('--workflow requires a PATH');
      }
      workflow = value;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return { selfTest, workflow };
}

function extractClassifier(workflowText) {
  const startRe = /python3 <<'PY'\r?\n/g;
  const starts = [];
  let match;
  while ((match = startRe.exec(workflowText)) !== null) {
    starts.push(match.index + match[0].length);
  }
  if (starts.length === 0) {
    throw new Error("extraction missing: no python3 <<'PY' classifier in workflow");
  }
  if (starts.length > 1) {
    throw new Error(`extraction ambiguous: found ${starts.length} python3 <<'PY' blocks`);
  }
  const rest = workflowText.slice(starts[0]);
  const endMatch = rest.match(/^[ \t]*PY[ \t]*\r?$/m);
  if (!endMatch) {
    throw new Error('extraction missing: no PY terminator for the classifier heredoc');
  }
  const python = rest.slice(0, endMatch.index);
  if (!python.includes('ALLOWED') || !python.includes('collect_ghsas')) {
    throw new Error('extraction missing: python block is not the audit classifier');
  }
  const inputHits = python.split('/tmp/npm-audit.json').length - 1;
  if (inputHits === 0) {
    throw new Error('extraction missing: classifier does not open /tmp/npm-audit.json');
  }
  if (inputHits !== 1) {
    throw new Error(`extraction ambiguous: /tmp/npm-audit.json occurs ${inputHits} times`);
  }
  if (!python.includes('"/tmp/npm-audit.json"')) {
    throw new Error('extraction missing: classifier does not open "/tmp/npm-audit.json"');
  }
  return python;
}

function dedent(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n');
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^[ \t]*/)[0].length);
  const min = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(min)).join('\n');
}

function trimOutput(text) {
  const normalized = text.replace(/\s+$/, '');
  if (normalized.length <= MAX_OUTPUT) return normalized;
  return `${normalized.slice(0, MAX_OUTPUT)}…`;
}

function interpretChild(result) {
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const combined = `${stdout}\n${stderr}`;
  if (result.error) {
    const detail = result.error.code === 'ETIMEDOUT' ? 'timed out' : result.error.message;
    return { kind: 'setup', exit: result.status, output: combined, detail };
  }
  if (/SyntaxError|IndentationError|TabError/.test(combined)) {
    return {
      kind: 'setup',
      exit: result.status,
      output: combined,
      detail: 'python syntax/compile error',
    };
  }
  if (/^Traceback \(most recent call last\):/m.test(combined)) {
    return {
      kind: 'setup',
      exit: result.status,
      output: combined,
      detail: 'uncaught python exception',
    };
  }
  if (result.status === 0 && combined.includes(PASS_MARKER)) {
    return { kind: 'pass', exit: 0, output: combined };
  }
  if (result.status === 1 && REJECT_MARKERS.some((marker) => combined.includes(marker))) {
    return { kind: 'reject', exit: 1, output: combined };
  }
  return {
    kind: 'setup',
    exit: result.status,
    output: combined,
    detail: `unexpected exit ${result.status}`,
  };
}

function redirectInputPath(python, fixturePath) {
  return python.replace('"/tmp/npm-audit.json"', JSON.stringify(fixturePath));
}

function runCase(python, tmpRoot, index, fixture) {
  const fixturePath = join(tmpRoot, `${index}.json`);
  const pyPath = join(tmpRoot, `${index}.py`);
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
  const redirected = redirectInputPath(python, fixturePath);
  if (redirected.includes('/tmp/npm-audit.json')) {
    return {
      kind: 'setup',
      exit: null,
      output: '',
      detail: 'input path redirect left /tmp/npm-audit.json in the classifier',
    };
  }
  writeFileSync(pyPath, redirected);
  const result = spawnSync('python3', [pyPath], {
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    cwd: tmpRoot,
  });
  return interpretChild(result);
}

function runSelfTest(workflowPath) {
  let workflowText;
  try {
    workflowText = readFileSync(workflowPath, 'utf8');
  } catch (err) {
    console.error(`check-audit-gate: cannot read workflow ${workflowPath}: ${err.message}`);
    process.exit(1);
  }

  let python;
  try {
    python = dedent(extractClassifier(workflowText));
  } catch (err) {
    console.error(`check-audit-gate: ${err.message}`);
    process.exit(1);
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), 'audit-gate-'));
  let passed = 0;
  let failed = 0;
  let setupFailed = 0;

  try {
    console.log(`check-audit-gate --self-test: workflow=${workflowPath}`);
    for (const [index, spec] of CASES.entries()) {
      let child;
      try {
        child = runCase(python, tmpRoot, index, spec.fixture);
      } catch (err) {
        child = {
          kind: 'setup',
          exit: null,
          output: '',
          detail: err.message,
        };
      }
      const outputUpper = `${child.output}`.toUpperCase();
      const missingGhsas =
        child.kind === 'setup'
          ? []
          : (spec.expectGhsas || []).filter((id) => !outputUpper.includes(id.toUpperCase()));
      const ok = child.kind === spec.expect && missingGhsas.length === 0;
      if (ok) {
        passed++;
        console.log(`  ✓ ${spec.name}`);
        continue;
      }
      failed++;
      if (child.kind === 'setup') setupFailed++;
      console.error(`  ✗ ${spec.name}`);
      if (child.kind === 'setup') {
        console.error(
          `    expected ${spec.expect}, child setup/compile error (not a classifier rejection): ${child.detail}`,
        );
      } else if (missingGhsas.length > 0) {
        console.error(
          `    missing-GHSA assertion: expected ${missingGhsas.join(', ')} in classifier output`,
        );
      } else {
        console.error(`    expected ${spec.expect}, classifier ${child.kind} (exit ${child.exit})`);
      }
      const clipped = trimOutput(child.output);
      if (clipped) console.error(`    output: ${clipped}`);
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  const total = CASES.length;
  const summary =
    `check-audit-gate --self-test: ${passed}/${total} passed, ${failed} failed` +
    (setupFailed ? ` (${setupFailed} child setup/compile errors, not classifier rejections)` : '');
  if (failed > 0) {
    console.error(summary);
    process.exit(1);
  }
  console.log(summary);
  process.exit(0);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(`check-audit-gate: ${err.message}`);
    console.error('usage: node scripts/check-audit-gate.mjs --self-test [--workflow PATH]');
    process.exit(1);
  }
  if (!args.selfTest) {
    console.error('usage: node scripts/check-audit-gate.mjs --self-test [--workflow PATH]');
    process.exit(1);
  }
  const workflowPath = resolve(args.workflow || DEFAULT_WORKFLOW);
  runSelfTest(workflowPath);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
