# DFX Wallet

Self-custodial mobile wallet for the DFX ecosystem. Multi-chain, hardware-wallet ready, built with React Native and the Tether Wallet Development Kit (WDK).

> **Status:** Early development (`v0.1.0`). APIs, flows and UI are still moving.

## Features

- **Self-custodial** — keys are generated and stored on device; the seed never leaves the user.
- **Multi-chain** via WDK:
  - Bitcoin on-chain
  - Ethereum + L2s (Arbitrum, Polygon, Optimism, Base)
  - Solana
  - TON
  - TRON
  - Spark / Lightning
- **Hardware wallet support** for BitBox02 (USB-HID on Android, BLE on Android + iOS via BitBox02 Nova).
- **Passkey-based wallet creation** (WebAuthn PRF) as an alternative to a 12/24-word seed.
- **DFX integration** — Buy, Sell, Send, Receive, KYC, transaction history and support tickets directly in the app.
- **Biometric unlock** (Face ID / Touch ID / fingerprint) on top of a local PIN.
- **i18n** — German and English.

## Tech Stack

| Area            | Choice                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Framework       | React Native (Expo `~54`, New Architecture)                                                                |
| Routing         | Expo Router (file-based)                                                                                   |
| Language        | TypeScript (strict)                                                                                        |
| Wallet SDK      | [`@tetherto/wdk-react-native-provider`](https://www.npmjs.com/package/@tetherto/wdk-react-native-provider) |
| Hardware wallet | [`bitbox-api`](https://www.npmjs.com/package/bitbox-api) (WASM) + `react-native-ble-plx`                   |
| State           | Zustand                                                                                                    |
| Storage         | `react-native-mmkv` (fast KV), `expo-secure-store` (secrets)                                               |
| i18n            | `i18next` + `react-i18next`                                                                                |

## Requirements

- Node.js 20+
- npm 10+
- Xcode 16+ with iOS 15.1 SDK (for iOS builds)
- Android Studio with SDK 35 / min SDK 29 (for Android builds)
- CocoaPods (installed automatically by Expo prebuild)

## Quick Start

```bash
# install dependencies (patches and WDK worklet bundling run automatically)
npm install

# run on iOS simulator
npm run ios

# run on Android emulator / device
npm run android

# Metro dev server only
npm start
```

The first iOS / Android run regenerates the native projects via `expo prebuild` if needed:

```bash
npm run prebuild
```

## Scripts

| Script                                  | Description                                            |
| --------------------------------------- | ------------------------------------------------------ |
| `npm run ios` / `npm run android`       | Build and launch on a simulator / emulator.            |
| `npm start`                             | Start the Expo dev server.                             |
| `npm run prebuild`                      | Regenerate `ios/` and `android/` from the Expo config. |
| `npm run typecheck`                     | TypeScript (`tsc --noEmit`).                           |
| `npm run lint` / `npm run lint:fix`     | ESLint.                                                |
| `npm run format` / `npm run format:fix` | Prettier.                                              |
| `npm run test`                          | Jest.                                                  |
| `npm run check`                         | `typecheck` + `lint` + `format` (run before pushing).  |
| `npm run bundle:bitbox`                 | Rebuild the bundled BitBox WASM module.                |

## Project Structure

```
app/                               # Expo Router screens (file-based routing)
  (onboarding)/                    # Welcome, create / restore, verify seed, PIN setup
  (pin)/                           # PIN unlock
  (auth)/                          # Authenticated area
    (tabs)/                        # Bottom tabs: Dashboard, Settings
    buy/ sell/ send/ receive/      # Wallet action flows
    hardware-connect/              # BitBox02 pairing (USB / BLE)
    kyc/                           # Multi-step KYC verification
    support/                       # Ticket system
    transaction-history/
src/
  components/                      # Shared UI components
  config/                          # Chain configs, environment
  hooks/                           # Custom React hooks
  i18n/                            # Localization (de, en)
  services/
    dfx/                           # DFX backend client + DTOs
    hardware-wallet/               # BitBox02 transport + provider
    passkey/                       # WebAuthn PRF wallet creation
  store/                           # Zustand stores
  theme/                           # Colors, typography
modules/                           # Native modules (Android USB-HID, etc.)
plugins/                           # Expo config plugins
patches/                           # patch-package patches
```

## Hardware Wallet (BitBox02)

The wallet uses [`bitbox-api`](https://github.com/BitBoxSwiss/bitbox-api-rs) (WASM) for the protocol stack — Noise XX handshake, Protobuf framing and signing are transport-agnostic. Only the byte-level read/write transport is platform-specific:

- **USB HID** — Android only (Apple does not allow third-party apps to talk to USB-HID devices).
- **BLE** — Android + iOS, for the BitBox02 Nova.

The wallet operates in a view-only model when paired: no seed is stored on device, signing is delegated to the hardware.

Signing is supported for:

- BTC: SegWit, Taproot, PSBT
- ETH: EIP-1559, ERC-20, EIP-712

## Branch Workflow

- Every change goes on a **feature branch** with a **pull request against `develop`**. Do not push directly to `develop` or `main`.
- Always start from the latest `develop`:

  ```bash
  git checkout develop && git pull origin develop
  git checkout -b feat/your-feature   # or fix/..., docs/..., chore/...
  ```

- `develop` → `main` is handled by an automated release PR.

Before pushing, run:

```bash
npm run check
```

## Contributing

Issues and pull requests are welcome. Please:

1. Open an issue first for non-trivial changes.
2. Keep PRs focused — one feature / fix per PR.
3. Run `npm run check` and make sure tests pass.
4. Update `de.json` and `en.json` together when touching i18n.

## License

[MIT](./LICENSE)
