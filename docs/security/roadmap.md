# Security & Quality Roadmap

Four phases. Each task carries acceptance criteria so it can be lifted
verbatim into a GitHub issue. Order within a phase is roughly by
dependency, not strict — anything in P0 should land before anything in P2.

Status legend: `[ ]` open, `[~]` in progress, `[x]` done.

---

## P0 — Foundation

The cheapest, broadest wins. Everything here is engineering hygiene that
makes later phases possible. None of it requires design or product input.

### P0.1 — Lint security ruleset

- [x] Done in PR #12 (`no-floating-promises`, `security`, `no-secrets`,
      `no-console: error`).

### P0.2 — Stricter TypeScript flags

- [ ] Enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
      `noImplicitOverride` in `tsconfig.json`.
- [ ] Fix all resulting errors. Do not loosen the flags or add casts to
      silence them.
- **Acceptance**: `npm run typecheck` clean with the new flags; PR diff
  shows the rule changes plus the fixes, no `as any` introduced.

### P0.3 — Test coverage gate

- [ ] Add Jest coverage thresholds (`global: 60%`, `src/services/**: 70%`,
      `src/services/hardware-wallet/**: 90%`).
- [ ] Wire `npm test -- --coverage` into CI as its own job.
- **Acceptance**: CI fails if a PR drops coverage below the gate; baseline
  documented in this file.

### P0.4 — CI hardening

- [ ] Pin every `uses:` in `.github/workflows/` to a commit SHA, not a
      floating tag.
- [ ] Add `permissions: contents: read` at workflow root, escalate
      per-job only where needed.
- [ ] Split `check` into parallel `typecheck`, `lint`, `format`, `test`
      jobs.
- **Acceptance**: workflows pass; `permissions` block present in every
  workflow file; no `@v4` / `@main` references.

### P0.5 — Supply-chain audit gates

- [ ] Add `npm audit --audit-level=high` as a CI step (non-blocking warn
      first, blocking after one cleanup pass).
- [ ] Enable Dependabot or Renovate for npm + GitHub Actions, weekly.
- [ ] Enable GitHub CodeQL for JavaScript/TypeScript.
- **Acceptance**: scheduled scans visible in the Security tab; first cleanup
  PR merged.

### P0.6 — Branch protection

- [ ] `develop` and `main`: require PR + green CI + ≥1 approval, no force
      push, signed commits encouraged.
- **Acceptance**: settings recorded in repo `README.md` or here; tested by
  attempting a direct push.

### P0.7 — `SECURITY.md`

- [x] Done in PR #22 — `SECURITY.md` at repo root with disclosure
      policy, response timeline, scope, safe-harbor; linked from
      `README.md`.

---

## P1 — Mobile hardening

Concrete defenses for the device + UX layer. Most are bounded changes that
ship per-screen or per-flow.

### P1.1 — Screen capture / screenshot block on sensitive screens

- [ ] Use `expo-screen-capture` (Android `FLAG_SECURE`, iOS
      `UIScreen.isCaptured` listener) on: seed reveal, seed verify, PIN entry,
      PIN setup, balance card.
- **Acceptance**: manual verification on device + emulator; Android
  screenshots return blank, iOS screen-recording obscures the view.

### P1.2 — App-backgrounding blur

- [ ] Render an opaque overlay when `AppState` transitions to
      `inactive`/`background`, on at least the same screens as P1.1 plus the
      authenticated tabs.
- **Acceptance**: switching apps shows the overlay before the OS snapshot
  is taken; no leakage in iOS task switcher.

### P1.3 — PIN bruteforce protection

- [ ] Track failed attempts in `expo-secure-store`. Apply exponential
      backoff. After N (e.g. 10) failures: wipe `expo-secure-store`,
      `IS_ONBOARDED`, encrypted seed, and reset to onboarding.
- [ ] UI shows remaining attempts and lockout time.
- **Acceptance**: dedicated test in `src/services/pin/` covers backoff
  schedule and wipe trigger; manual test confirms recovery flow.

### P1.4 — Biometric re-auth before signing

- [ ] Require `expo-local-authentication` success immediately before any
      call into the WDK signing path or the BitBox signing path. Cache result
      for ≤30s of foreground time.
- **Acceptance**: signing without recent biometric prompts; cancellation
  aborts cleanly and surfaces no exception.

### P1.5 — Clipboard hygiene

- [ ] On copy of address: announce "copied", auto-clear after 60s if
      clipboard still holds the same value.
- [ ] On copy of mnemonic: confirmation modal explaining the risk; same
      60s auto-clear.
- **Acceptance**: integration test on `Clipboard.setStringAsync` calls;
  manual verification on iOS + Android.

### P1.6 — Deep-link allowlist

- [ ] Strict parser for `dfx://` and Universal Links. Reject unknown
      hosts/paths. Never auto-confirm a sensitive action (send, swap, KYC
      callback) from a deep-link payload — always require the user to confirm
      pre-filled data.
- [ ] Universal Links signed via Apple AASA / Android assetlinks.
- **Acceptance**: fuzz-test the parser; manual test that a hostile deep
  link cannot trigger a transaction without confirmation.

### P1.7 — WebView hardening

- [ ] Audit every `react-native-webview` usage: `originWhitelist` minimal,
      `allowFileAccess: false`, `javaScriptEnabled` only when required, no
      `injectedJavaScript` carrying user data.
- **Acceptance**: review document listing each WebView and its config.

### P1.8 — Network security

- [ ] HTTPS only. iOS `NSAppTransportSecurity` strict, Android
      `cleartextTrafficPermitted=false`.
- [ ] Certificate pinning for `api.dfx.swiss` and `app.dfx.swiss` via
      `react-native-ssl-pinning` or platform config.
- [ ] Pin rotation playbook documented.
- **Acceptance**: MITM proxy fails to intercept; pin-rotation steps
  recorded here.

### P1.9 — Jailbreak / root warning

- [ ] On app launch, check for jailbreak/root indicators. If detected,
      show a non-blocking warning with risk explanation. Do not block usage.
- **Acceptance**: warning visible on a jailbroken simulator profile;
  unaffected on stock devices.

### P1.10 — Crash reporting with PII filter

- [ ] Wire Sentry (or equivalent) with `beforeSend` filter that strips:
      addresses, amounts, mnemonic-shaped strings, JWTs, KYC field values.
- [ ] No automatic breadcrumbs from sensitive screens.
- **Acceptance**: deliberate crash from a test screen produces a Sentry
  event with no PII; review checklist in this doc.

### P1.11 — Force-update / kill-switch

- [ ] On every API session start, fetch a min-supported-version from the
      backend. If app version is below it, show a blocking update screen
      (only Settings → Reset is reachable).
- **Acceptance**: dev-server returning a higher min-version triggers the
  block; works offline-first (graceful degradation if endpoint
  unreachable).

---

## P2 — Crypto / Hardware-Wallet audit prep

Tightening the parts an external auditor will look at hardest. None of
this is shippable as a single feature — it is the work that makes the
audit cheap.

### P2.1 — Address derivation test vectors

- [ ] Add property-based tests (`fast-check`) and BIP-vector tests for
      every supported chain: BTC (BIP44/49/84/86), EVM, Solana, TON, TRON,
      Spark/Lightning.
- **Acceptance**: per-chain test files under `test/derivation/`; CI runs
  them; failing a vector breaks CI.

### P2.2 — BIP21 / EIP-681 / payment-URI parsers

- [ ] Single source of truth per scheme. Property-based tests for
      malformed input. Fuzz round-tripping.
- **Acceptance**: parsers under `src/services/payment-uri/`; tests cover
  amount precision, decimals across chains, malicious unicode.

### P2.3 — Decimal arithmetic enforcement

- [ ] Lint rule (`no-restricted-syntax`) banning `Number` arithmetic on
      monetary values. Centralise in a `Money` helper backed by `decimal.js`.
- **Acceptance**: rule active in `eslint.config.js`; `Money` helper has
  100% coverage; no `parseFloat(amount) + ...` patterns left.

### P2.4 — BitBox Noise pubkey pinning

- [ ] Persist BitBox static pubkey on first successful pairing. On
      subsequent connects, refuse to proceed if it changes; require explicit
      re-pair confirmation.
- **Acceptance**: pairing flow re-tested; tampered pubkey produces a hard
  stop with a clear error message.

### P2.5 — Hardware-display ↔ UI parity guarantee

- [ ] Document and test that for every signing operation (BTC PSBT, ETH
      EIP-1559, EIP-712, ERC-20), the values shown on-device on the BitBox
      match what the app displayed — including units and decimals.
- **Acceptance**: parity matrix in this directory; manual verification
  recorded per supported transaction type before each release.

### P2.6 — WDK worklet integrity

- [ ] Verify the bundled worklet (`wdk-secret-manager-worklet.bundle.js`)
      is reproducible from source. Pin the `bare-pack` version, lock the
      Tether SDK versions exactly (no `^`).
- **Acceptance**: build from clean checkout produces byte-identical
  worklet bundle; comparison automated in CI.

### P2.7 — Pricing correctness

- [ ] Audit every pricing read path. On error, refuse to proceed (no
      stale-fallback rendering of an amount).
- [ ] Add an explicit "could not load price" UI state.
- **Acceptance**: simulating an API error produces an error state, not a
  silently-stale price; documented in threat-model section 4.

### P2.8 — Signed builds + SBOM

- [ ] EAS Build with managed credentials. Keystore + provisioning
      profiles in EAS Secrets, not in repo.
- [ ] CycloneDX SBOM produced per release as a build artifact.
- **Acceptance**: release page lists `.sbom.json`; signing keys never
  appear in the repo.

### P2.9 — Reproducible builds

- [ ] Document the exact toolchain (Node version, npm version, Xcode
      version, Android SDK). Pin in `package.json` `engines` and EAS config.
- [ ] CI re-builds the artifact and compares hashes against the release.
- **Acceptance**: two clean builds from the same git ref produce
  byte-equal binaries (best effort — note any unavoidable
  non-determinism).

---

## P3 — External audit + bounty

### P3.1 — Pre-audit readiness review

- [ ] Internal walkthrough against the threat model. Ensure every
      mitigation marked `✓` or `~` is actually true. Fix gaps before paying
      for an external review.
- **Acceptance**: review notes filed under `docs/security/`; threat model
  refreshed.

### P3.2 — Vendor selection

- Candidates worth a quote (engineering opinion only, no commitment):
  - **Cure53** — strong on mobile + WebView surfaces.
  - **Trail of Bits** — strong on cryptography + native crypto code.
  - **Least Authority** — wallet-specific track record.
- [ ] Scope a fixed-price audit: in scope = onboarding, signing, BitBox
      flow, DFX API integration; out of scope = DFX backend, third-party
      KYC iframe.
- **Acceptance**: signed SoW; kickoff date set.

### P3.3 — Audit remediation

- [ ] All Critical / High findings fixed before public release.
- [ ] Medium findings either fixed or have a tracked workaround +
      follow-up issue.
- **Acceptance**: audit report lives under `docs/security/audits/`;
  remediation PRs cross-referenced.

### P3.4 — Bug bounty

- [ ] After remediation: launch a private bounty (HackerOne or Immunefi).
      Public after one quiet month.
- [ ] Scope, rewards, safe-harbor language drafted.
- **Acceptance**: bounty page live; first triage rotation scheduled.

---

## Process appendix

### Disclosure

Vulnerabilities reported through `SECURITY.md` (P0.7) get acknowledged
within 72 hours, triaged within one week. Public disclosure happens after
a fix ships, or 90 days after report — whichever comes first.

### Incidents

A real or near-miss security incident produces (1) a chronological
post-mortem in `docs/security/incidents/YYYY-MM-DD-<slug>.md`, (2) an
update to `threat-model.md`, (3) a roadmap entry under the appropriate
phase if a structural change is needed.

### Reviews

Any PR touching `src/services/hardware-wallet/`, `src/services/wallet/`,
`src/services/dfx/`, `src/services/pin/`, `src/services/biometric/`, or
secure storage requires a security-conscious review (one of the
maintainers tagged for security). Document this requirement in
`CODEOWNERS` once the file exists.
