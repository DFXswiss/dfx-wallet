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

Both scripts run every flow under `.maestro/`. To run a single flow:

```bash
maestro test .maestro/01-welcome.yaml
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

## Limitations

- **Hardware Wallet flows**: Maestro cannot drive physical BitBox02 devices or BLE pairing dialogs. Hardware-wallet tests must run against the mock provider in `src/services/hardware-wallet/`.
- **Biometrics**: Face ID / Fingerprint prompts are scriptable on simulators (`xcrun simctl ... biometric` / `adb emu finger touch`) but require an explicit step in the flow.
- **Passkeys**: WebAuthn / Passkey ceremonies cannot be fully automated on simulators yet — gate passkey-dependent flows behind a feature flag for E2E builds.

## CI

`.github/workflows/maestro-e2e.yml` runs the full suite on iOS Simulator and Android Emulator. Currently triggered manually via `workflow_dispatch`; auto-trigger on PR is intentionally disabled until the suite covers enough flows to justify the runtime.
