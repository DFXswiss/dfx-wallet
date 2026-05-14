# DFX Wallet

Self-custodial mobile wallet for the DFX ecosystem. Multi-chain, hardware-wallet ready, built with React Native and the Tether Wallet Development Kit (WDK).

> **Status:** Early development (`v0.1.0`). APIs, flows and UI are still moving.

## Features

This matrix lists every user-facing function the app exposes, the technical
components that implement it, whether it ships on by default, and the
current test coverage. It is the source of truth for "what does this wallet
actually do" — keep it in sync when adding or removing a flow.

**MVP scope.** The MVP is intentionally narrow: _create a wallet, receive
tokens, send tokens._ Everything else is `deferred` behind a build-time
`EXPO_PUBLIC_ENABLE_*` flag (off by default) and only ships when it has
dedicated test coverage. A function being marked `deferred` is a
**triage decision**, not a statement about code quality — most of these
flows already exist and work; they are simply held back until their
tests are written.

**Code isolation.** Every deferred feature lives in
`src/features/<feature>/` and is loaded through a conditional
`require()` against a `FEATURES.X` constant from `src/config/features.ts`.
Expo's `babel-preset-expo` inlines `process.env.EXPO_PUBLIC_*` at build
time, so each `FEATURES.X` reduces to a boolean literal and Metro's
dead-code elimination drops the unused module from the bundle. That
means a production build with the flag off does not _load, parse, or
execute_ the deferred code: a bug in a deferred feature cannot crash
the MVP, and a compromised dependency in a deferred feature cannot
reach the MVP runtime.

**Status legend**

- `always` — MVP function, wired up on every build, no flag to turn off
- `deferred (EXPO_PUBLIC_ENABLE_X)` — off by default, opt-in via the
  named build-time flag; required to be 100% test-covered before the
  flag flips on by default
- `env` — configuration variable (URL / API key / RPC override), not a
  feature switch; defaults are baked into `src/config/`

**Test legend**

- `full` — unit + integration tests cover the happy path and at least one
  failure mode
- `partial` — only a helper, sub-service, or screen baseline is covered;
  the end-to-end flow has no dedicated test
- `none` — no automated test references the code path

`deferred` rows are not required to be `full` today — the flag stays off
until they are. `always` rows must reach `full` for the MVP to ship.

### Onboarding & Authentication

| Function                                 | Technical components                                                                                          | Status                                                          | Tests                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Welcome / entry screen                   | `app/(onboarding)/welcome.tsx`, `isPasskeySupported()` gate                                                   | always                                                          | partial (Detox visual baseline, Maestro `01-welcome.yaml`)                                           |
| Create wallet from generated seed        | `(onboarding)/create-wallet.tsx`, `services/wallet/seed.ts`, WDK `useWalletManager.initializeFromMnemonic`    | always                                                          | full (`test/services/seed.test.ts`, Detox `onboarding.test.ts`, Maestro `10-onboarding-create.yaml`) |
| Restore wallet from 12 / 24-word seed    | `(onboarding)/restore-wallet.tsx`, `validateSeedPhrase`, WDK                                                  | deferred (`EXPO_PUBLIC_ENABLE_RESTORE`)                         | partial (seed unit tests + Detox + Maestro `11-onboarding-restore.yaml`, no screen unit test)        |
| Verify seed phrase (post-create quiz)    | `(onboarding)/verify-seed.tsx`                                                                                | deferred (`EXPO_PUBLIC_ENABLE_RESTORE`)                         | none                                                                                                 |
| Create wallet via Passkey (WebAuthn PRF) | `(onboarding)/create-passkey.tsx`, `services/passkey/passkey-service.ts`, `key-derivation.ts` (HKDF → BIP-39) | deferred (`EXPO_PUBLIC_ENABLE_PASSKEY`) — iOS 18+ / Android 14+ | none                                                                                                 |
| Restore wallet via Passkey               | `(onboarding)/restore-passkey.tsx`, `services/passkey/setup-wallet.ts`                                        | deferred (`EXPO_PUBLIC_ENABLE_PASSKEY`)                         | none                                                                                                 |
| Legal disclaimer acceptance              | `(onboarding)/legal-disclaimer.tsx`                                                                           | deferred (`EXPO_PUBLIC_ENABLE_LEGAL`)                           | partial (Detox baseline only)                                                                        |
| PIN setup                                | `(onboarding)/setup-pin.tsx`, `services/pin.ts`, `useAuthStore.setPin`                                        | deferred (`EXPO_PUBLIC_ENABLE_PIN`)                             | full (`test/store/auth.test.ts`, Detox `setup-pin`/`setup-pin-confirm` baselines)                    |

### Lock / Unlock

| Function                                            | Technical components                                                                                                | Status                                    | Tests                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| PIN unlock (cold start, deep link, JS reload)       | `app/(pin)/verify.tsx`, `useAuthStore.verifyPin`, WDK `useWalletManager.unlock`, `MAX_ATTEMPTS = 5`                 | deferred (`EXPO_PUBLIC_ENABLE_PIN`)       | full (`test/store/auth.test.ts` + Detox `verify-pin*` + Maestro `12-pin-unlock.yaml`) |
| Biometric unlock (Face ID / Touch ID / fingerprint) | `services/biometric.ts`, `expo-local-authentication`, `useAuthStore.authenticateBiometric`, `biometricEnabled` flag | deferred (`EXPO_PUBLIC_ENABLE_BIOMETRIC`) | full (`test/services/biometric.test.ts`, `test/store/auth.test.ts`)                   |
| Auth gate around every `(auth)/*` route             | `app/(auth)/_layout.tsx`, hard redirect to `/(pin)/verify` when `isAuthenticated` is false                          | deferred (`EXPO_PUBLIC_ENABLE_PIN`)       | partial (covered indirectly via PIN-unlock E2E)                                       |

### Wallet actions

| Function                                                 | Technical components                                                                                                                                      | Status                                                               | Tests                                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard total balance                                  | `app/(auth)/(tabs)/dashboard.tsx`, `useTotalPortfolioFiat`, `services/balances/`, `pricing-service.ts`                                                    | always                                                               | partial (`pricing-service.test.ts`, `test/store/wallet.test.ts`; no hook/screen test)                                                                                            |
| Hide balance (eye toggle)                                | `dashboard.tsx` local state                                                                                                                               | deferred (`EXPO_PUBLIC_ENABLE_PORTFOLIO`)                            | none                                                                                                                                                                             |
| Receive (BTC native / Lightning / EVM stables)           | `(auth)/receive/index.tsx`, `components/QrCode`, WDK `useAccount`, `useLdsWallet` (LN address)                                                            | always                                                               | none                                                                                                                                                                             |
| Send native + ERC-20                                     | `(auth)/send/index.tsx`, `useSendFlow`, WDK `sendFromAccount` / `estimateFee`, `components/QrScanner`                                                     | always                                                               | partial (`evm-address.test.ts`, `evm-signature.test.ts`; no flow test)                                                                                                           |
| Buy (DFX fiat on-ramp, SEPA)                             | `(auth)/buy/index.tsx`, `useBuyFlow`, `dfx/payment-service.ts`, `dfx/asset-service.ts`, `dfx/fiat-service.ts`, `DfxAuthGate`                              | deferred (`EXPO_PUBLIC_ENABLE_BUY_SELL`)                             | partial (`dfx-api.test.ts`, `dfx-auth-gate.test.ts`, `dfx-auth-service.test.ts`; no flow test)                                                                                   |
| Sell (DFX off-ramp to IBAN)                              | `(auth)/sell/index.tsx`, `useSellFlow`, `dfx/payment-service.ts`, `DfxAuthGate`                                                                           | deferred (`EXPO_PUBLIC_ENABLE_BUY_SELL`)                             | partial (same DFX-API/auth tests; no flow test)                                                                                                                                  |
| Portfolio (local + DFX-linked wallets)                   | `(auth)/portfolio/index.tsx`, `services/balances/useBalances.ts`, `useEvmBalances`, `useWdkBalances`, `useLinkedWalletDiscovery`, `useLinkedWalletFiat`   | deferred (`EXPO_PUBLIC_ENABLE_PORTFOLIO`)                            | partial (`btc-fetcher.test.ts`, `blockscout.test.ts`, `etherscan.test.ts`, `coingecko-*.test.ts`, `discoverable-tokens.test.ts`, `pricing-service.test.ts`; no screen/hook test) |
| Asset detail screen                                      | `(auth)/portfolio/[symbol].tsx`                                                                                                                           | deferred (`EXPO_PUBLIC_ENABLE_PORTFOLIO`)                            | none                                                                                                                                                                             |
| Chain enable / disable                                   | `(auth)/portfolio/manage.tsx`, `useEnabledChains` (MMKV-backed)                                                                                           | deferred (`EXPO_PUBLIC_ENABLE_PORTFOLIO`)                            | none                                                                                                                                                                             |
| Linked wallet detail (per-address holdings + tx history) | `(auth)/linked-wallet/[address].tsx`, `useLinkedWalletDiscovery`, `useWalletTransactions`, `useLinkedWalletNames`, Blockscout + Etherscan + mempool.space | deferred (`EXPO_PUBLIC_ENABLE_LINKED_WALLETS`)                       | partial (explorer + discovery libs tested; no hook test)                                                                                                                         |
| Transaction history (local wallet, DFX-side)             | `(auth)/transaction-history/index.tsx`, `(auth)/transaction-history/[id].tsx`, `dfx/transaction-service.ts`                                               | deferred (`EXPO_PUBLIC_ENABLE_TX_HISTORY`)                           | none                                                                                                                                                                             |
| Pay (QR scan → payment URL)                              | `(auth)/pay/index.tsx`, `expo-camera` CameraView                                                                                                          | deferred (`EXPO_PUBLIC_ENABLE_PAY`) — placeholder, coming-soon alert | none                                                                                                                                                                             |

### DFX backend integration

| Function                                                                                | Technical components                                                                                                           | Status                                      | Tests                                                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DFX silent sign-in (wallet → JWT)                                                       | `useDfxAuth`, `dfx/auth-service.ts`, `dfx/jwt.ts`, `dfx/api.ts` 401-retry hook                                                 | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | full (`dfx-auth-service.test.ts`, `dfx-jwt.test.ts`, `dfx-api.test.ts`, `dfx-auth-gate.test.ts`) |
| DFX e-mail login / account merge                                                        | `(auth)/dfx-login/index.tsx`, `dfxAuthService`, `/v1/auth/mail`, JWT `account` claim diff                                      | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | partial (auth-service tested; merge flow not)                                                    |
| Auto-link BTC / EVM / Lightning to DFX account                                          | `useDfxAutoLink`, `DFX_LINKED_CHAINS` cache in secure store, `useLdsWallet`                                                    | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | none                                                                                             |
| DFX-linked wallets management (list / rename / hide / link extra address)               | `(auth)/wallets/index.tsx`, `dfx/user-service.ts`, `useLinkedWalletNames`, `useLinkedWalletSelection`, `useLinkedWalletReauth` | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | none                                                                                             |
| KYC multi-step wizard (Email → Personal → Nationality → Financial → 2FA → Sumsub/IDnow) | `(auth)/kyc/index.tsx`, `useKycFlow`, `dfx/kyc-service.ts`, `(auth)/webview.tsx`, `services/security/safe-url.ts`              | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | partial (only `dfx-kyc-service.test.ts → registerEmail`; wizard untested)                        |
| User data summary (email, phone)                                                        | `(auth)/email/index.tsx`, `dfx/user-service.ts` `/v2/user`                                                                     | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | none                                                                                             |
| Support tickets (list / create / chat)                                                  | `(auth)/support/index.tsx`, `dfx/support-service.ts`                                                                           | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | none                                                                                             |
| Contact channels (mailto, tel, web, in-app support)                                     | `(auth)/contact/index.tsx`, `Linking`, `services/security/safe-url.ts`                                                         | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | none                                                                                             |
| Tax report CSV export (CoinTracking et al.)                                             | `(auth)/tax-report/index.tsx`, `dfx/transaction-service.ts` (`requestCsv`), `expo-file-system`, `expo-sharing` (soft import)   | deferred (`EXPO_PUBLIC_ENABLE_TAX_REPORT`)  | none                                                                                             |
| Legal documents launcher (T&C, Privacy, Disclaimer)                                     | `(auth)/legal/index.tsx`, OS browser hand-off via `Linking`, `safe-url` allow-list                                             | deferred (`EXPO_PUBLIC_ENABLE_LEGAL`)       | none                                                                                             |

### Settings & preferences

| Function                                    | Technical components                                                                                                                                                                              | Status                                                                                 | Tests                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Language switcher (DE ↔ EN)                 | `(auth)/(tabs)/settings.tsx`, `i18next`, `dfxUserService.updateUser` sync                                                                                                                         | deferred (`EXPO_PUBLIC_ENABLE_SETTINGS`)                                               | none                                                                                              |
| Display currency (CHF / EUR / USD)          | `settings.tsx`, `useWalletStore.setSelectedCurrency`, persisted in secure store, `dfxUserService.updateUser` sync                                                                                 | deferred (`EXPO_PUBLIC_ENABLE_SETTINGS`)                                               | full (`test/store/wallet.test.ts`)                                                                |
| Biometric unlock toggle                     | `settings.tsx`, `useAuthStore.setBiometricEnabled`                                                                                                                                                | deferred (`EXPO_PUBLIC_ENABLE_BIOMETRIC`)                                              | full (covered under "Biometric unlock" above)                                                     |
| Seed phrase export                          | `(auth)/seed-export.tsx`, WDK `useWalletManager`, passkey re-auth for passkey-origin wallets, `expo-screen-capture` (soft import)                                                                 | deferred (`EXPO_PUBLIC_ENABLE_SETTINGS`)                                               | partial (`seed.test.ts` covers the lib; screen untested)                                          |
| Hardware wallet pairing (BitBox02)          | `(auth)/hardware-connect/index.tsx`, `services/hardware-wallet/bitbox.ts`, `transport-usb.ts` (Android only), `transport-ble.ts`, `BitboxWasmWebView.tsx`, `wasm-bridge.ts`, `bitbox-protocol.ts` | deferred (`EXPO_PUBLIC_ENABLE_HARDWARE_WALLET`)                                        | partial (`hardware-wallet.test.ts` only covers `ethSignatureToHex`; transports + bridge untested) |
| Multi-sig vault setup (local cosigner list) | `(auth)/multi-sig/index.tsx`, `(auth)/multi-sig/setup.tsx`, `useMultiSigStore`                                                                                                                    | deferred (`EXPO_PUBLIC_ENABLE_MULTISIG`) — Zustand store only, no on-chain signing yet | none                                                                                              |
| Delete wallet                               | `settings.tsx`, WDK `deleteWallet`, `useAuthStore.reset`, secure-store wipe                                                                                                                       | deferred (`EXPO_PUBLIC_ENABLE_SETTINGS`)                                               | partial (`auth.test.ts` covers `reset`; flow itself untested)                                     |

### Security & platform

| Function                                                                  | Technical components                                                                                           | Status                                      | Tests                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| PIN bruteforce limit (5 attempts → reset to onboarding)                   | `app/(pin)/verify.tsx` `MAX_ATTEMPTS = 5`                                                                      | deferred (`EXPO_PUBLIC_ENABLE_PIN`)         | partial (Detox `verify-pin-error` baseline; counter logic untested) |
| Screen-capture protection on seed screen                                  | `(auth)/seed-export.tsx` soft import of `expo-screen-capture`                                                  | deferred (`EXPO_PUBLIC_ENABLE_SETTINGS`)    | none                                                                |
| Deep-link payment URL handling (`dfxwallet://buy`, `sell`, `send?to=...`) | `useDeepLink`, `expo-linking`                                                                                  | deferred (`EXPO_PUBLIC_ENABLE_DEEPLINKS`)   | none                                                                |
| WebView host allow-list (KYC, legal, payment hand-off)                    | `(auth)/webview.tsx`, `services/security/safe-url.ts` (`isAllowedDfxHost`, `isDfxOwnedHost`, `isSafeHttpsUrl`) | deferred (`EXPO_PUBLIC_ENABLE_WEBVIEW`)     | none                                                                |
| Offline banner                                                            | `components/OfflineBanner.tsx`, `@react-native-community/netinfo`                                              | always                                      | none                                                                |
| Global error boundary                                                     | `components/ErrorBoundary.tsx`, mounted in `app/_layout.tsx`                                                   | always                                      | none                                                                |
| DFX session 401 silent retry                                              | `dfx/api.ts` `setOnUnauthorized`, `useDfxAuth.authenticateSilent`                                              | deferred (`EXPO_PUBLIC_ENABLE_DFX_BACKEND`) | full (`dfx-api.test.ts`, `dfx-auth-service.test.ts`)                |

### Feature flags (`EXPO_PUBLIC_ENABLE_*`)

Every `deferred` row in the matrix above is gated by one of these
build-time flags. They are **off by default**. A flag flips to "on by
default" only once every function it gates is `full` in the test
matrix. Each flag isolates the code path so that a build with the flag
off can never load, parse, or execute the deferred module — the goal
is both crash-safety (broken WIP code can't take the MVP down) and
defense-in-depth (a compromised dependency in a non-MVP path can't
reach the MVP runtime).

| Flag                                 | Gated functions                                                                                                                                                     | Default |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `EXPO_PUBLIC_ENABLE_RESTORE`         | Restore wallet from seed, Verify seed phrase                                                                                                                        | off     |
| `EXPO_PUBLIC_ENABLE_PASSKEY`         | Create + Restore wallet via Passkey                                                                                                                                 | off     |
| `EXPO_PUBLIC_ENABLE_LEGAL`           | Legal disclaimer acceptance, Legal documents launcher                                                                                                               | off     |
| `EXPO_PUBLIC_ENABLE_PIN`             | PIN setup, PIN unlock, Auth gate around `(auth)/*`, PIN bruteforce limit                                                                                            | off     |
| `EXPO_PUBLIC_ENABLE_BIOMETRIC`       | Biometric unlock, Biometric toggle in Settings                                                                                                                      | off     |
| `EXPO_PUBLIC_ENABLE_PORTFOLIO`       | Hide-balance toggle, Portfolio screen, Asset detail, Chain enable/disable                                                                                           | off     |
| `EXPO_PUBLIC_ENABLE_BUY_SELL`        | Buy (fiat on-ramp), Sell (off-ramp)                                                                                                                                 | off     |
| `EXPO_PUBLIC_ENABLE_LINKED_WALLETS`  | Linked wallet detail screen                                                                                                                                         | off     |
| `EXPO_PUBLIC_ENABLE_TX_HISTORY`      | Transaction history                                                                                                                                                 | off     |
| `EXPO_PUBLIC_ENABLE_PAY`             | Pay (QR scan placeholder)                                                                                                                                           | off     |
| `EXPO_PUBLIC_ENABLE_DFX_BACKEND`     | DFX silent sign-in, e-mail login, auto-link, DFX-linked wallets management, KYC, user data summary, support tickets, contact channels, DFX session 401 silent retry | off     |
| `EXPO_PUBLIC_ENABLE_TAX_REPORT`      | Tax report CSV export                                                                                                                                               | off     |
| `EXPO_PUBLIC_ENABLE_SETTINGS`        | Settings screen and the entries it owns: language switcher, display currency, seed phrase export, delete wallet, screen-capture protection                          | off     |
| `EXPO_PUBLIC_ENABLE_HARDWARE_WALLET` | BitBox02 pairing (USB + BLE + WASM bridge)                                                                                                                          | off     |
| `EXPO_PUBLIC_ENABLE_MULTISIG`        | Multi-sig vault setup (local cosigner list)                                                                                                                         | off     |
| `EXPO_PUBLIC_ENABLE_DEEPLINKS`       | Deep-link payment URL handler                                                                                                                                       | off     |
| `EXPO_PUBLIC_ENABLE_WEBVIEW`         | In-app WebView (KYC iframe, payment hand-off) and the `safe-url` allow-list                                                                                         | off     |

### Build-time configuration (`EXPO_PUBLIC_*`)

These variables are configuration, not feature switches: they override
URLs, RPC providers, or API keys. Defaults are baked into
`src/config/chains.ts` / `src/config/env.ts` so the app runs with none of
them set.

| Variable                                                          | Effect                                                                                                                | Default                                   | Tests                                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `EXPO_PUBLIC_DFX_API_URL`                                         | DFX backend base URL (auth, buy/sell, KYC, support, tx history)                                                       | `https://api.dfx.swiss`                   | full (covered by every `dfx-*` service test)                  |
| `EXPO_PUBLIC_LDS_URL`                                             | Lightning Data Service base URL (LN address resolution)                                                               | `https://lightning.space/v1`              | none                                                          |
| `EXPO_PUBLIC_ETHERSCAN_API_KEY`                                   | Enables Etherscan V2 transaction feed for linked-wallet history; without it falls back to Blockscout / curated tokens | empty                                     | full (`test/services/etherscan.test.ts` exercises both paths) |
| `EXPO_PUBLIC_ETH_RPC_URL`                                         | Custom Ethereum RPC (Alchemy / Infura / keyed provider)                                                               | `https://ethereum-rpc.publicnode.com`     | none                                                          |
| `EXPO_PUBLIC_ARBITRUM_RPC_URL`                                    | Custom Arbitrum RPC                                                                                                   | `https://arbitrum-one-rpc.publicnode.com` | none                                                          |
| `EXPO_PUBLIC_POLYGON_RPC_URL`                                     | Custom Polygon RPC                                                                                                    | `https://polygon-bor-rpc.publicnode.com`  | none                                                          |
| `EXPO_PUBLIC_BASE_RPC_URL`                                        | Custom Base RPC                                                                                                       | `https://base-rpc.publicnode.com`         | none                                                          |
| `EXPO_PUBLIC_PLASMA_RPC_URL`                                      | Custom Plasma RPC                                                                                                     | `https://rpc.plasma.to`                   | none                                                          |
| `EXPO_PUBLIC_SEPOLIA_RPC_URL`                                     | Custom Sepolia (testnet) RPC                                                                                          | `https://sepolia.gateway.tenderly.co`     | none                                                          |
| `EXPO_PUBLIC_BTC_ELECTRUM_HOST` / `EXPO_PUBLIC_BTC_ELECTRUM_PORT` | Custom Electrum server for the BTC WDK provider                                                                       | `electrum.blockstream.info:50001`         | none                                                          |
| `EXPO_PUBLIC_WDK_INDEXER_URL` / `EXPO_PUBLIC_WDK_INDEXER_API_KEY` | WDK indexer for richer balance + transaction queries                                                                  | unset (RPC-only mode)                     | none                                                          |

### Supported chains (via WDK bundle)

Production: Bitcoin on-chain, Spark / Lightning, Ethereum, Arbitrum,
Polygon, Base, Plasma. Testnet: Sepolia. Each EVM chain ships with an
ERC-4337 paymaster (Candide) so users can pay gas in USDT / USDC where
available. The active set lives in `wdk.config.js`; the worklet bundle
is regenerated by `npm run bundle:wdk` (also runs in `postinstall`).

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

## Security

Found a vulnerability? Please follow [`SECURITY.md`](./SECURITY.md) — do
not open a public issue. The threat model and security roadmap live under
[`docs/security/`](./docs/security/).

## License

[MIT](./LICENSE)
