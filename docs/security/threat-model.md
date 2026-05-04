# Threat Model

The DFX Wallet is a non-custodial mobile wallet. The phone — and optionally a
BitBox hardware wallet — holds the only material that controls the user's
funds. Everything in this document is framed by that asymmetry: we cannot
recover from a key compromise, so prevention dominates detection.

## 1. Assets

In rough order of value to an attacker.

| Asset                                         | Where it lives                                                         | Loss impact                                          |
| --------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| Seed / mnemonic                               | `expo-secure-store` (Keychain / Keystore), JS heap during signing      | Total loss of all funds across all chains            |
| PIN                                           | Hashed in `expo-secure-store`; PIN itself only in JS heap during entry | Bypass of app-level auth → seed access               |
| Signing context (PSBT, EIP-712, etc.)         | JS heap, briefly in WDK Bare worklet                                   | Funds stolen via swapped recipient/amount            |
| BitBox pairing state (Noise XX static pubkey) | `expo-secure-store` (planned)                                          | MITM on hardware-wallet channel                      |
| DFX API session token                         | `expo-secure-store`                                                    | Unauthorized KYC / fiat actions for the user         |
| KYC PII (name, address, ID, financial data)   | DFX backend; transient on device                                       | Privacy breach, regulatory exposure                  |
| Telemetry / crash reports                     | Sentry (planned)                                                       | Indirect leakage of any of the above if filters fail |

## 2. Attacker profiles

We design against, in increasing capability:

1. **Casual thief** — has the unlocked phone for a few minutes. Defeated by
   PIN + biometric + auto-lock + screen-capture protection.
2. **Targeted attacker with the phone** — has the locked phone and time.
   Defeated by full-device encryption (OS responsibility) + brute-force
   resistance on the PIN (hash + rate-limit + wipe-after-N).
3. **Malicious app on the same device** — installed by user, no root.
   Defeated by Keychain/Keystore isolation, no clear-text storage, deep-link
   validation, no broadcast-leakable intents.
4. **Network attacker** — can MITM any plaintext or unauthenticated channel.
   Defeated by TLS, certificate pinning for `api.dfx.swiss` (planned), Noise
   handshake on BitBox transports.
5. **Supply-chain attacker** — compromises an npm package, GitHub Action, or
   build artifact. Defeated by lockfile integrity, audit gates, pinned action
   SHAs, signed releases (planned), reproducible builds (planned).
6. **Compromised DFX backend** — partial trust boundary. The wallet must
   refuse to sign anything the backend asks for that does not match what the
   user sees on screen. Pricing must never silently fall back to a stale
   value.
7. **Rooted / jailbroken device** — partial mitigation only. We warn but do
   not block, since blocking is bypassable and harms power users.
8. **Nation-state attacker with physical access** — out of scope for the app
   alone; the BitBox + view-only wallet model is the answer.

## 3. Attack surfaces

| Surface                              | Concrete vectors                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Local storage                        | Wrong storage class (MMKV vs. SecureStore), stale data after uninstall, plaintext spillover |
| PIN entry & biometric                | Shoulder-surfing, screen recording, screenshots, fault injection on retry counter           |
| Clipboard                            | Other apps reading recipient addresses, mnemonic copies left behind                         |
| Deep links                           | Malicious `dfx://` URLs that pre-fill send forms, hijack KYC callbacks                      |
| WebView (KYC iframe, embedded flows) | JS injection, file access, third-party cookie leakage                                       |
| BitBox transport                     | BLE MITM during pairing, USB driver vulnerabilities, fake pairing UI                        |
| WDK Bare worklet                     | Worklet bundle tampering at build time, IPC boundary errors                                 |
| DFX API                              | Compromised endpoint serving malicious responses (esp. addresses, pricing, payment URLs)    |
| Push notifications / linking flows   | Phishing-quality URLs delivered through trusted-looking surfaces                            |
| Build pipeline                       | Compromised CI runner, malicious dependency postinstall, leaked signing keys                |
| Release channels                     | Side-loaded APK with same package name, App Store account compromise                        |

## 4. Mitigation status

`✓` = in place. `~` = partial. `✗` = not yet. See `roadmap.md` for the path
from `~`/`✗` to `✓`.

| Mitigation                                                                       | Status     |
| -------------------------------------------------------------------------------- | ---------- |
| Strict TypeScript                                                                | ✓          |
| Lint guardrails (`no-floating-promises`, `security`, `no-secrets`, `no-console`) | ✓ (PR #12) |
| Seed/PIN in `expo-secure-store` only, never MMKV                                 | ✓          |
| PIN bruteforce backoff + wipe-after-N                                            | ✗          |
| Biometric re-auth before signing operations                                      | ✗          |
| Screen-capture / FLAG_SECURE on seed, PIN, balance                               | ✗          |
| App-backgrounding blur on sensitive screens                                      | ✗          |
| Clipboard auto-clear after copy of address / mnemonic                            | ✗          |
| Deep-link strict allowlist + signed Universal Links for KYC                      | ✗          |
| WebView hardening (originWhitelist, no file access, no injectedJS leakage)       | ✗          |
| BitBox Noise pubkey pinning after first pairing                                  | ✗          |
| Hardware-display ↔ UI parity check before signing                                | ~          |
| TLS only + certificate pinning for `api.dfx.swiss`                               | ✗          |
| Pricing: never serve stale/swapped values, fail loud                             | ~          |
| Jailbreak / root detection (warn, not block)                                     | ✗          |
| `npm audit` + automated supply-chain scanning in CI                              | ~          |
| Pinned GitHub Action SHAs + minimal `permissions:`                               | ✗          |
| Signed builds, reproducible builds, SBOM                                         | ✗          |
| Force-update / kill-switch via API min-version check                             | ✗          |
| Crash reporting with PII filter (`beforeSend`)                                   | ✗          |
| `SECURITY.md` + responsible disclosure policy                                    | ✓ (PR #22) |
| External security audit                                                          | ✗          |
| Bug bounty program                                                               | ✗          |

## 5. Trust boundaries

- **Phone OS ↔ App**: we trust Keychain/Keystore. We do not trust the
  filesystem, MMKV, AsyncStorage, or anything that survives an uninstall on
  Android.
- **App ↔ WDK Bare worklet**: the worklet is the signing oracle. We trust
  its bundle iff it came from the build we shipped — supply-chain integrity
  matters here as much as for the app itself.
- **App ↔ BitBox**: trusted only after Noise handshake completes and the
  static pubkey matches the one stored at first pairing.
- **App ↔ DFX backend**: partial trust. Funds-affecting data (addresses,
  amounts, pricing, payment URLs) must be displayed verbatim and confirmed
  by the user before any signing. The backend can be wrong or hostile; the
  wallet must not amplify that into a loss.
- **App ↔ Third-party SDKs (Sentry, KYC iframe vendor, etc.)**: untrusted.
  Sandboxed in WebView where applicable; PII filter on telemetry.

## 6. Non-goals

- We do not protect against an attacker who has already extracted the seed
  by other means.
- We do not promise resistance to nation-state-level attackers with a
  jailbroken or rooted device under their control. The hardware-wallet flow
  is the answer for high-value users.
- We do not provide on-device malware detection.

## 7. Updating this document

This file changes whenever:

- a new asset, surface, or attacker profile becomes relevant (new chain,
  new flow, new SDK);
- a mitigation moves between `✗`, `~`, `✓`;
- a real incident or near-miss happens — the post-mortem belongs here.

Don't let it rot. A stale threat model is worse than none, because it
implies coverage that no longer exists.
