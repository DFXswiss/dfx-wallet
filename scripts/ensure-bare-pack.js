#!/usr/bin/env node
// Ensures `bare-pack@1` is on PATH before npm prepares git deps that call
// `npx bare-pack --target ...` in their postinstall/prepare scripts.
//
// Why this is needed:
//   The pinned commit of @tetherto/pear-wrk-wdk runs `npx bare-pack --target ...`
//   without pinning a version. The latest published `bare-pack@2` removed the
//   `--target` flag, so the install fails with `Bail: UNKNOWN_FLAG: target`.
//   Installing `bare-pack@^1` globally makes `npx bare-pack` resolve to v1
//   (npx prefers an executable on PATH over fetching the latest).
//
// Safe to run repeatedly: it skips work if a v1 is already available.

const { execSync, spawnSync } = require('node:child_process');

function log(msg) {
  process.stdout.write(`[ensure-bare-pack] ${msg}\n`);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function getInstalledMajor() {
  // bare-pack@1 does not implement --version, so query npm for the global install.
  const r = run('npm', ['ls', '-g', 'bare-pack', '--depth=0', '--json']);
  if (r.status !== 0) return null;
  try {
    const parsed = JSON.parse(r.stdout || '{}');
    const v = parsed?.dependencies?.['bare-pack']?.version;
    if (!v) return null;
    const m = String(v).match(/(\d+)\.\d+\.\d+/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

const major = getInstalledMajor();
if (major === 1) {
  log('bare-pack v1 already on PATH — nothing to do.');
  process.exit(0);
}

if (major != null) {
  log(`found bare-pack v${major} on PATH; installing v1 globally to override.`);
} else {
  log('bare-pack not found on PATH; installing v1 globally.');
}

try {
  execSync('npm install -g bare-pack@^1', { stdio: 'inherit' });
} catch (err) {
  log('failed to install bare-pack@^1 globally.');
  log('You may need elevated permissions or a writable npm prefix.');
  log('Workaround: `npm install -g bare-pack@^1` manually, then re-run install.');
  process.exit(err.status || 1);
}

const after = getInstalledMajor();
if (after !== 1) {
  log(`installed bare-pack but resolved version is v${after}. Aborting.`);
  process.exit(1);
}
log('bare-pack v1 ready.');
