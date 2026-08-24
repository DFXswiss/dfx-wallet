import { execFileSync } from 'node:child_process';

// These advisories currently have no patched release. Keep the exceptions at
// advisory level so any newly reported high/critical issue still fails CI.
const temporarilyAllowed = new Set([
  'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq', // image-size
  'https://github.com/advisories/GHSA-r292-9mhp-454m', // tar
  'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr', // image-size
]);

let output;
try {
  output = execFileSync('npm', ['audit', '--audit-level=high', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  output = error.stdout;
  if (!output) throw error;
}

const report = JSON.parse(output);
const vulnerabilities = new Map(Object.entries(report.vulnerabilities ?? {}));
const blocked = new Set();

function collect(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);

  for (const cause of vulnerabilities.get(name)?.via ?? []) {
    if (typeof cause === 'string') {
      collect(cause, seen);
    } else if (
      ['high', 'critical'].includes(cause.severity) &&
      !temporarilyAllowed.has(cause.url)
    ) {
      blocked.add(`${cause.name}: ${cause.url}`);
    }
  }
}

for (const [name, vulnerability] of vulnerabilities) {
  if (['high', 'critical'].includes(vulnerability.severity)) collect(name);
}

if (blocked.size > 0) {
  console.error('Unapproved high/critical npm advisories:');
  for (const advisory of [...blocked].sort()) console.error(`- ${advisory}`);
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `npm audit passed (${counts.high ?? 0} high findings are limited to ${temporarilyAllowed.size} temporarily allowed, unfixed advisories).`,
);
