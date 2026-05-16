# Maestro E2E Tests

End-to-end UI tests for DFX Wallet using [Maestro](https://maestro.mobile.dev/). Flows live in `.maestro/` as YAML.

## Why Maestro

- Works with Expo dev-client and release builds (no separate test instrumentation needed)
- YAML flows — low barrier to add coverage
- Single flow runs against both iOS Simulator and Android Emulator
- Self-hosted in GitHub Actions, no external service dependency

## Prerequisites

The wallet ships native modules that are not Expo Go compatible (`react-native-ble-plx`, `react-native-mmkv`, `react-native-nitro-modules`, `bitbox-api`, `@tetherto/wdk-react-native-provider`). Maestro therefore requires an installed dev-client or release build, never Expo Go.

- Maestro CLI: `brew tap mobile-dev-inc/tap && brew install maestro` (or `curl -Ls https://get.maestro.mobile.dev | bash`)
- iOS: Xcode 16+, an iOS Simulator (run `xcrun simctl list devices`), and Facebook IDB (`brew tap facebook/fb && brew install idb-companion`) — required by Maestro to drive the simulator
- Android: Android SDK with an emulator image (API 34+, x86_64)
- Built and installed app:
  - iOS: `npx expo run:ios --configuration Release`
  - Android: `npx expo run:android --variant release`

Disable Face ID / Touch ID enrollment in the iOS Simulator (`Features > Face ID > Enrolled` off) before running flows — biometric prompts will otherwise intercept the PIN screen during onboarding.

## Running Locally

Boot a simulator/emulator first, then:

```bash
# iOS Simulator (must be booted)
npm run e2e:maestro:ios

# Android Emulator (must be booted)
npm run e2e:maestro:android
```

Both scripts run every MVP flow under `.maestro/` (see [MVP vs feature-gated flows](#mvp-vs-feature-gated-flows) below). To run a single flow:

```bash
maestro test --env APP_ID=wallet.dfx.swiss .maestro/01-welcome.yaml         # iOS
maestro test --env APP_ID=swiss.dfx.wallet .maestro/01-welcome.yaml         # Android
```

To debug interactively:

```bash
maestro studio
```

## Test Configuration

Flows target a Testnet build of the app. The relevant environment variables are read by `src/config/env.ts` and `src/config/chains.ts` and must be set at **build time** (not at Maestro runtime — they are baked into the JS bundle):

```bash
EXPO_PUBLIC_DFX_API_URL=...        # DFX API testnet endpoint
EXPO_PUBLIC_WDK_INDEXER_URL=...    # WDK indexer endpoint
EXPO_PUBLIC_ETH_RPC_URL=...        # ETH testnet RPC
# ... see src/config/chains.ts for the full list
```

Set these before `npx expo run:ios` / `npx expo run:android` so the resulting binary points at testnet infrastructure.

### `appId: ${APP_ID}` and platform-specific bundle IDs

The iOS bundle id is `wallet.dfx.swiss`, the Android package id is `swiss.dfx.wallet`. Every flow uses `appId: ${APP_ID}` and the workflow passes the platform-specific value at run time:

```yaml
appId: ${APP_ID}
name: 01-welcome
```

```yaml
# .github/workflows/maestro-e2e.yml
maestro --platform ios test --env APP_ID=wallet.dfx.swiss .maestro/
maestro --platform android test --env APP_ID=swiss.dfx.wallet .maestro/
```

Do not hard-code one of the two ids — the flow will fail on the other platform with `Failed to get app binary directory for bundle <id>`.

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

Container elements (the screen root) carry the `<screen>-screen` ID; interactive elements append a verb-noun (`-button`, `-toggle`, `-input`, `-checkbox`, `-key-N`). Iterable lists use the item key as a suffix: `receive-asset-btc`, `send-chain-arbitrum`, `pin-key-1`.

## MVP vs feature-gated flows

Every flow is tagged so the workflow can opt into the slice that matches the build under test:

- `mvp` — runs against the default-off feature-flag build that ships today
- `feature-restore`, `feature-pin`, `feature-legal`, `feature-passkey`, … — gated; only meaningful when the corresponding `EXPO_PUBLIC_ENABLE_*` is `true` at build time

```yaml
appId: ${APP_ID}
name: 11-onboarding-create-pin-legal
tags:
  - onboarding
  - feature-pin
  - feature-legal
```

The CI workflow filters with `--include-tags mvp` so only the unflagged paths fire today:

```yaml
maestro --platform ios test --include-tags mvp --env APP_ID=wallet.dfx.swiss .maestro/
```

Drop the `--include-tags` filter as each feature ships. Locally, omit the flag to run everything (gated flows will fail against the MVP build — that's expected, run them against a build with the matching feature enabled).

## Flow Naming

```
<NN>-<area>-<scenario>.yaml
```

- `NN` = two-digit prefix; smoke onboarding flows start at `01`-`09`, gated onboarding variants at `10`-`19`, dashboard navigation flows at `20`+
- `area` = onboarding, pin, send, receive, dashboard, kyc, hardware
- `scenario` = short kebab-case description

### Current flows

MVP (run by `--include-tags mvp` in CI):

- `01-welcome.yaml` — smoke: welcome screen renders with the create-wallet button
- `10-onboarding-create.yaml` — fresh install → create wallet → reveal seed → continue → `SetupPinDisabled` redirect → dashboard
- `20-receive.yaml` — onboarding → Receive (asset list) → tap BTC → QR step → back to asset list
- `21-send.yaml` — onboarding → Send (asset list) → tap BTC → input step → back to asset list
- `22-dashboard-balance-toggle.yaml` — onboarding → dashboard → toggle eye icon (visible → hidden → visible)
- `23-receive-chain-switch.yaml` — onboarding → Receive → BTC chain bar (SegWit ⇄ EVM); CHF has no chain bar (single chain)
- `24-send-chain-switch.yaml` — onboarding → Send → CHF chain bar (Ethereum / Arbitrum / Polygon / Base); BTC has no chain bar (single chain)

Feature-gated (run by removing `--include-tags mvp` against a build with all flags on):

- `02-welcome-restore-toggle.yaml` — `feature-restore`: welcome-restore-toggle assertion (only rendered when RESTORE or PASSKEY is on)
- `11-onboarding-create-pin-legal.yaml` — `feature-pin` + `feature-legal`: full PIN-setup and legal-disclaimer chain through to the fully-featured dashboard
- `12-onboarding-restore.yaml` — `feature-restore` + `feature-pin` + `feature-legal`: enter a BIP39 mnemonic and walk through to the dashboard
- `13-pin-unlock.yaml` — `feature-pin` + `feature-legal`: onboard, cold-restart, exercise the wrong-PIN error path, unlock with the correct PIN

## Limitations

- **Hardware Wallet flows**: Maestro cannot drive physical BitBox02 devices or BLE pairing dialogs. Hardware-wallet tests must run against the mock provider in `src/services/hardware-wallet/`.
- **Biometrics**: Face ID / Fingerprint prompts are scriptable on simulators (`xcrun simctl ... biometric` / `adb emu finger touch`) but require an explicit step in the flow.
- **Passkeys**: WebAuthn / Passkey ceremonies cannot be fully automated on simulators yet — gate passkey-dependent flows behind a feature flag for E2E builds.

### Keyboard handling across platforms

The two soft keyboards behave differently and the Maestro CLI exposes that asymmetry:

| Action                | iOS                         | Android                     |
| --------------------- | --------------------------- | --------------------------- |
| `tapOn: "return"`     | ✅ taps the return key       | ❌ no "return" text element |
| `hideKeyboard`        | ❌ fails on custom TextInputs | ✅ works                    |

The MVP send flow (`21-send.yaml`) deliberately stops at the input step rather than typing into the recipient/amount inputs and pressing Continue: every keyboard-dismissal primitive fails on one of the two platforms. Confirm-flow coverage lives in the Detox visual suite ([docs/visual-regression.md](visual-regression.md)) where the keyboard is controllable programmatically.

Tests that absolutely have to type into an input (currently only the gated `12-onboarding-restore.yaml`) use `hideKeyboard` — iOS happens to accept it on the restore mnemonic input.

## CI

`.github/workflows/maestro-e2e.yml` runs the MVP suite (`--include-tags mvp`) on iOS Simulator and Android Emulator.

### Runners

- **iOS Simulator** → `macos-latest`. Builds via `npx expo run:ios --configuration Release --no-bundler`.
- **Android Emulator** → `ubuntu-latest` with `/dev/kvm` enabled. Builds via `./gradlew :app:assembleRelease` and runs the AVD via [`reactivecircus/android-emulator-runner`](https://github.com/ReactiveCircus/android-emulator-runner).

**Why Linux for Android?** GitHub's `macos-latest` runners disable Hypervisor.framework, so both `x86_64` (via Rosetta) and `arm64-v8a` (via HVF) AVDs fail to boot with `HVF error: HV_UNSUPPORTED`. Linux runners expose `/dev/kvm`; the workflow grants user-level access via a `udev` rule and the emulator drops into native KVM acceleration:

```yaml
- name: Enable KVM
  run: |
    echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
    sudo udevadm control --reload-rules
    sudo udevadm trigger --name-match=kvm
```

The release Gradle build gets `-Xmx4096m -XX:MaxMetaspaceSize=1024m` so it fits the smaller Linux runner heap.

### Triggers

- `pull_request` against `develop` — non-draft PRs only, skipped on doc-only changes (`paths-ignore: '**/*.md', 'docs/**'`). Marking a draft PR as ready-for-review fires the workflow.
- `workflow_dispatch` — manual run for any branch.

Concurrent runs on the same PR cancel each other (`concurrency: cancel-in-progress: true`), so rebases don't pile up macOS minutes.

### Build-time configuration

- Public values (DFX API URL, WDK indexer URL, chain RPCs) live in the committed `.env.testnet` at the repo root. Edit that file when the testnet endpoints land.
- Only the WDK indexer API key is treated as a secret. Set it as a repo **secret** named `E2E_WDK_INDEXER_API_KEY` — the workflow injects it via `env:` so it overrides whatever's in `.env.testnet`.
- Both jobs do `cp .env.testnet .env` before the build so Expo's `EXPO_PUBLIC_*` baking sees the right values.

For local runs, do the same: `cp .env.testnet .env && npm run ios` (or `android`). Override the API key by adding a single line `EXPO_PUBLIC_WDK_INDEXER_API_KEY=...` to your `.env` after the copy.
