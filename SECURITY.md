# Security Policy

The DFX Wallet is a non-custodial mobile wallet. A vulnerability here can
mean direct loss of user funds. We treat security reports accordingly and
ask the same of researchers.

## Reporting a vulnerability

Email **security@dfx.swiss** with:

- a description of the issue,
- the affected component (app version, OS, chain, hardware wallet model
  if relevant),
- reproduction steps or proof-of-concept,
- the impact you believe it has.

Please do **not** open a public GitHub issue, pull request, or discussion
for security findings. Public disclosure before a fix puts users at risk.

## Response timeline

| Stage                                  | Target                                                |
| -------------------------------------- | ----------------------------------------------------- |
| Acknowledgement of receipt             | within 72 hours                                       |
| Initial triage and severity assessment | within 7 days                                         |
| Status updates during remediation      | at least weekly                                       |
| Public disclosure / advisory           | after a fix ships, or 90 days — whichever comes first |

If you do not hear back within 72 hours, please re-send your report — it
may have been caught by a spam filter.

## Scope

**In scope**

- The DFX Wallet mobile app in this repository (`DFXswiss/dfx-wallet`),
  iOS and Android.
- The wallet's integration with the Tether Wallet Development Kit (WDK)
  as it ships in this repo.
- The wallet's integration with the BitBox02 hardware wallet (USB-HID,
  BLE).
- The wallet's integration with the public DFX API (`api.dfx.swiss`)
  from the wallet side: request construction, response handling,
  display logic.
- Onboarding, key generation, seed handling, PIN, biometric, signing
  flows, deep links.

**Out of scope**

- The DFX backend itself (`api.dfx.swiss`, `app.dfx.swiss`) — these are
  tracked separately. Findings against the backend should still be
  reported to the same address; we will route them.
- Third-party KYC vendor surfaces embedded via WebView.
- Issues in upstream dependencies (Tether WDK, `bitbox-api`, Expo, React
  Native) without a wallet-side amplifier — please report those upstream
  as well.
- Denial-of-service against a single user's own device.
- Social engineering of DFX staff or users.
- Physical attacks against a device the attacker already controls.
- Findings only reproducible on jailbroken / rooted devices, unless
  they cross a trust boundary the OS would normally enforce.
- Best-practice suggestions without a demonstrable security impact
  (e.g. "you should use header X") — file these as regular issues.

## Safe harbor

We will not pursue legal action or report to law enforcement against
researchers who:

- act in good faith to identify and report a vulnerability,
- avoid privacy violations, data destruction, and service degradation,
- give us reasonable time to investigate and remediate before any public
  disclosure,
- do not exploit the issue beyond what is necessary to demonstrate it,
- do not access, modify, or retain other users' data,
- do not test against accounts they do not own (use throwaway DFX
  accounts; we will help arrange test funds if needed).

If in doubt about whether a planned action falls within these limits,
ask first via the same address.

## Recognition

We do not currently run a paid bug bounty. We do credit reporters in
release notes and the security advisory unless anonymity is requested. A
public bounty is on the roadmap (see
[`docs/security/roadmap.md`](./docs/security/roadmap.md), P3.4).

## Related

- [`docs/security/threat-model.md`](./docs/security/threat-model.md) —
  what we are protecting and against whom.
- [`docs/security/roadmap.md`](./docs/security/roadmap.md) — the work
  plan for hardening the wallet over time.
