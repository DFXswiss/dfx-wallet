# Maestro E2E Tests

End-to-end UI tests for DFX Wallet using [Maestro](https://maestro.mobile.dev/). Flows live in `.maestro/` as YAML.

## Architecture

| Stage | Service | Purpose |
| --- | --- | --- |
| Build | [EAS Build](https://docs.expo.dev/build/introduction/) (Production tier) | Cloud build, signed iOS Simulator `.app` + Android `.apk` |
| Test  | [Maestro Cloud](https://cloud.mobile.dev/) (Team tier) | Parallel device fleet, runs the flows in `.maestro/` against the artifacts |
| Glue  | GitHub Actions | Triggers EAS builds, downloads artifacts, ships them to Maestro Cloud |

No self-hosted runners, no Xcode/Android-SDK on developer machines for CI builds, no nested-VM headaches. Both build and test stages cache aggressively at the vendor level.

Local development still uses `npx expo run:ios` / `run:android` and `maestro test .maestro/` against a personal simulator/emulator — see "Running Locally".

## Why this stack

- **EAS Build** is the path Expo officially supports for Expo apps. It understands the entire native module set (`react-native-ble-plx`, `react-native-mmkv`, `react-native-nitro-modules`, `bitbox-api`, `@tetherto/wdk-react-native-provider`) without bespoke patches and survives Expo SDK upgrades cleanly.
- **Maestro Cloud** parallelises the flows across real Cloud devices and reports cleanly back to the PR.
- We tried self-hosted Tart VMs on dfx01 (M3 Ultra). Verdict: macOS guests on Apple Silicon don't support nested HVF, so the Android emulator can't run inside. Linux ARM64 has no official `emulator` SDK package either. Net: self-hosted is cheaper but eats engineering hours every Xcode update; not worth it for a small team.

## CI Workflow

`.github/workflows/maestro-e2e.yml`. Triggers:

- `pull_request` against `develop` — non-draft PRs only, skipped on doc-only changes.
- `workflow_dispatch` — manual run for any branch.

Concurrent runs on the same PR cancel each other.

Pipeline shape:

```
checkout
  → npm ci
  → eas build --profile e2e --platform all (parallel iOS + Android)
  → wait for builds (typical: 5-10 min)
  → download .app.tar.gz + .apk
  → maestro cloud (parallel iOS + Android)
  → results posted back to the PR
```

Expected wall-clock per PR: 8-15 min depending on EAS queue + flow count.

## Required Configuration

### Repo secrets (`Settings → Secrets and variables → Actions`)

| Name | Source | Purpose |
| --- | --- | --- |
| `EXPO_TOKEN` | https://expo.dev/settings/access-tokens | Authenticate `eas-cli` against the Expo project |
| `MAESTRO_CLOUD_API_KEY` | https://cloud.mobile.dev → Profile → API Keys | Authenticate Maestro Cloud uploads |

### Repo variables

| Name | Value | Purpose |
| --- | --- | --- |
| `EXPO_OWNER` | Expo account/org slug that owns the project | Used to render dashboard links in the workflow log |

### EAS project setup (one-time)

```bash
npm install -g eas-cli   # or use npx
eas login
eas init                  # links the repo to an Expo project (writes the project ID into app.json)
```

After `eas init`, `app.json` gains an `extra.eas.projectId` field — commit that.

### EAS Secrets (the actual WDK indexer key)

EAS Build runs in Expo's cloud, so secrets need to live there too. The WDK indexer key is the only secret value the build needs at compile time:

```bash
eas secret:create \
  --scope project \
  --name EXPO_PUBLIC_WDK_INDEXER_API_KEY \
  --value "<your-key>"
```

EAS injects this into the build env automatically, no further wiring in `eas.json`. Public values (DFX API URL, WDK indexer URL) stay in `eas.json`'s `env` block — committed because they're not secrets.

### `eas.json`

The `e2e` profile is configured for:

- iOS Simulator builds (`ios.simulator: true` — no signing, no Apple Developer account needed)
- Android APK with Release Gradle command (`android.buildType: "apk"`)
- Public testnet env vars inline (`env`)

## testID Convention

Flows use stable `testID` selectors (`id:` in YAML) — text-based selectors are avoided so flows are i18n-proof. Convention:

```
<screen>-<element>
```

Examples:

- `welcome-screen` (container of the welcome screen)
- `welcome-create-wallet-button`
- `welcome-restore-toggle`
- `welcome-restore-seed-button`
- `pin-key-1` … `pin-key-9`, `pin-key-0`, `pin-key-del`
- `setup-pin-screen` / `setup-pin-confirm-screen` (same screen, two states)
- `dashboard-screen`
- `dashboard-action-send`

Container elements (the screen root) carry the `<screen>-screen` ID; interactive elements append a verb-noun (`-button`, `-toggle`, `-input`, `-checkbox`, `-key-N`).

## Flow Naming

```
<NN>-<area>-<scenario>.yaml
```

- `NN` = two-digit prefix; smoke flows start at `01-`, feature flows at `10-`
- `area` = onboarding, pin, send, receive, dashboard, kyc, hardware
- `scenario` = short kebab-case description

Current flows:

- `01-welcome.yaml` — smoke: app launches, welcome screen renders
- `10-onboarding-create.yaml` — full create-wallet onboarding through to dashboard
- `11-onboarding-restore.yaml` — restore-from-seed onboarding through to dashboard (uses `${TEST_MNEMONIC}` env var, default is the standard `test test … junk` BIP39 mnemonic)
- `12-pin-unlock.yaml` — onboard, cold-restart the app, exercise the wrong-PIN error path, then unlock with the correct PIN

## Running Locally

For day-to-day development, run flows against your own simulator/emulator. Maestro Cloud is for CI only.

Prereqs:

- Maestro CLI: `curl -Ls https://get.maestro.mobile.dev | bash`
- iOS: Xcode + booted simulator. Disable Face ID enrollment in the sim (`Features > Face ID > Enrolled` off) or biometric prompts will hijack the PIN flow.
- Android: Android SDK + booted emulator (API 34+).
- Built and installed app:
  - iOS: `npx expo run:ios --configuration Release`
  - Android: `npx expo run:android --variant release`

Run all flows:

```bash
maestro test .maestro/
```

Single flow:

```bash
maestro test .maestro/01-welcome.yaml
```

Interactive recorder:

```bash
maestro studio
```

## Limitations

- **Hardware Wallet flows**: Maestro can't drive physical BitBox02 devices or BLE pairing dialogs. Hardware-wallet tests run against the mock provider in `src/services/hardware-wallet/`.
- **Biometrics**: Face ID / Fingerprint prompts can be scripted on local simulators; on Maestro Cloud devices we keep biometrics disabled in the test scenario.
- **Passkeys**: WebAuthn / Passkey ceremonies aren't fully automatable on Cloud devices yet — gate passkey-dependent flows behind a feature flag for E2E builds.
