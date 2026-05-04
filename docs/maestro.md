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
- iOS: Xcode 16+, an iOS Simulator (run `xcrun simctl list devices`)
- Android: Android SDK with an emulator image (API 34+, x86_64)
- Built and installed app:
  - iOS: `npx expo run:ios --configuration Release`
  - Android: `npx expo run:android --variant release`

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
maestro test .maestro/01-app-launch.yaml
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

Flows prefer text/accessibility selectors first (resilient across themes) and fall back to `testID` for ambiguous elements. Convention:

```
<screen>.<element>
```

Examples:

- `welcome.create-button`
- `welcome.restore-toggle`
- `pin.digit-1`
- `verify-seed.word-3`
- `dashboard.action-send`

Add `testID` props only when text selectors are ambiguous (e.g. multiple buttons with the same label, generated content, icons without text).

## Flow Naming

```
<NN>-<area>-<scenario>.yaml
```

- `NN` = two-digit prefix; smoke flows start at `01-`, feature flows at `10-`
- `area` = onboarding, pin, send, receive, dashboard, kyc, hardware
- `scenario` = short kebab-case description

Examples: `01-app-launch.yaml`, `10-onboarding-create.yaml`, `20-send-btc.yaml`.

## Limitations

- **Hardware Wallet flows**: Maestro cannot drive physical BitBox02 devices or BLE pairing dialogs. Hardware-wallet tests must run against the mock provider in `src/services/hardware-wallet/`.
- **Biometrics**: Face ID / Fingerprint prompts are scriptable on simulators (`xcrun simctl ... biometric` / `adb emu finger touch`) but require an explicit step in the flow.
- **Passkeys**: WebAuthn / Passkey ceremonies cannot be fully automated on simulators yet — gate passkey-dependent flows behind a feature flag for E2E builds.

## CI

`.github/workflows/maestro-e2e.yml` runs the full suite on iOS Simulator and Android Emulator. Currently triggered manually via `workflow_dispatch`; auto-trigger on PR is intentionally disabled until the suite covers enough flows to justify the runtime.
