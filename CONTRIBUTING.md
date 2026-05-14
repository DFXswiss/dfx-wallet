# Contributing to DFX Wallet

This guide covers everything you need to develop, test, and contribute to the DFX Wallet app.

## Quick Start

```bash
git clone https://github.com/DFXswiss/dfx-wallet.git
cd dfx-wallet
npm install
npx expo start                     # dev server
npx expo start --ios               # iOS simulator
npx expo start --android           # Android emulator
```

## Prerequisites

| Tool        | Version    | Purpose                                  |
| ----------- | ---------- | ---------------------------------------- |
| Node.js     | 20+        | Runtime                                  |
| npm         | 10+        | Package manager                          |
| Xcode       | 15+        | iOS builds (macOS only)                  |
| Android SDK | API 34+    | Android builds                           |
| Expo CLI    | bundled    | React Native tooling (via `npx expo`)    |

## Build & Test Commands

```bash
npm run typecheck      # TypeScript check (tsc --noEmit)
npm run lint           # ESLint
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier check
npm run format:fix     # Prettier auto-fix
npm run test           # Jest
npm run check          # typecheck + lint + format (run before pushing)
npx expo prebuild --clean   # regenerate native projects
```

Run `npm run check` before every push. Never push if it fails.

## Tech Stack

- **Framework**: React Native (Expo ~54, Expo Router)
- **Language**: TypeScript (strict mode)
- **Wallet SDK**: Tether WDK (`@tetherto/wdk-react-native-provider`)
- **State**: Zustand
- **i18n**: i18next + react-i18next (DE, EN)
- **Storage**: react-native-mmkv (fast KV), expo-secure-store (secrets)
- **Navigation**: Expo Router (file-based, mirrors Next.js)

## Project Structure

```
app/                               # Expo Router screens (file-based routing)
  (onboarding)/                    # Welcome, Create/Restore Wallet, Verify Seed, Setup PIN
  (pin)/                           # PIN verification
  (auth)/                          # Authenticated area
    (tabs)/                        # Bottom tabs: Dashboard, Settings
    buy/ sell/ send/ receive/      # Wallet action flows
    kyc/                           # Multi-step KYC verification
    support/                       # Ticket system
    transaction-history/
src/
  components/                      # Shared UI components
  config/                          # Chain configs, environment
  hooks/                           # Custom React hooks
  i18n/                            # Localization (DE, EN)
  models/                          # Domain models / types
  services/dfx/                    # DFX API client + DTOs
  services/hardware-wallet/        # BitBox02 integration
  store/                           # Zustand stores
  theme/                           # Colors, typography
```

## Git Workflow — CRITICAL

### Branches

| Branch    | Purpose                            | Deploy target |
| --------- | ---------------------------------- | ------------- |
| `develop` | Default branch, active development | DEV builds    |
| `main`    | Production releases                | Store builds  |

- Every change goes in a **feature-specific branch** with a **pull request against `develop`**. Never push directly to `develop` or `main`.
- **Always start from the latest `develop`** before creating a new branch:

```bash
git checkout develop && git pull origin develop
git checkout -b feat/your-feature   # or fix/..., docs/..., chore/...
```

- `develop` moves quickly — multiple PRs land in parallel. Treat any local `develop` older than a few minutes as stale and pull again before branching.
- Never reuse an old branch after its PR was merged or closed — cut a fresh branch from current `develop`.
- Build **on top of** existing changes in `develop`. If your work overlaps with a recent merge, rebase onto the new `develop` rather than working around it.
- Never force-push, never amend published commits.
- Squash-and-merge when merging to `develop` — preserve atomic commits on the branch; the squash keeps only the PR title on `develop`.
- Release PRs (`develop` → `main`) are created automatically — never open them manually.

### Branch Naming

- Features: `feat/<scope>-<topic>`
- Fixes: `fix/<scope>-<topic>`
- Docs: `docs/<topic>`
- Chores: `chore/<topic>`

### Commit Messages

Write in English. Imperative mood. No trailing period on the subject. Describe _what_ changed, not _how_.

```
# Good
Add BitBox02 BLE transport for Nova
Fix balance refresh after send transaction
Use DfxColors instead of raw hex in dashboard

# Bad
update stuff
WIP
fix
```

## Code Style

### TypeScript

- **Strict mode** — `strict: true` in tsconfig
- **Functional components with hooks** — no class components
- **No `any`** — use explicit types, especially in DTOs
- **No `console.log`** in committed code
- **No unused imports**
- **Named exports** for components, default exports only for routed screens

### Formatting

- **ESLint**: `npm run lint`
- **Prettier**: enforced via `npm run format`
- Run `npm run check` before every commit

### Imports

Order: React → React Native → Expo → third-party → `@/` local.

```typescript
// 1. React
import { useCallback, useState } from 'react';

// 2. React Native
import { View, Text } from 'react-native';

// 3. Expo
import { useRouter } from 'expo-router';

// 4. Third-party
import { create } from 'zustand';

// 5. Internal (absolute paths via @/)
import { useWalletStore } from '@/store/wallet';
import { DfxColors } from '@/theme/colors';
```

Use the `@/` path alias for everything under `src/`.

### Styling — CRITICAL

- **Colors**: Always use `DfxColors.*` from `src/theme/colors.ts`. NEVER use raw hex values or RN defaults.
- **Typography**: Always use `Typography.*` from `src/theme/typography.ts`. NEVER hardcode font sizes.
- **Loading**: Use RN `ActivityIndicator` — no third-party spinners.

### State Management

- **Zustand** stores in `src/store/`
- **No React Context** for state — Zustand stores are global singletons
- Secrets in `expo-secure-store`, fast KV in `react-native-mmkv`

### API Client

All DFX backend communication goes through `src/services/dfx/api.ts`:

- DTOs in `src/services/dfx/dto/` with explicit types (no `any`)
- Never call `fetch()` directly — always use the typed API client

## Localization (i18n)

- Source files: `src/i18n/locales/de.json` and `en.json`
- Keys are nested by feature: `dashboard.title`, `buy.title`, etc.
- Keys MUST be alphabetically sorted within each namespace
- Always update BOTH `de` and `en` files in the same PR

## Design Reference

- **Theme**: Light. Soft sky-blue / white surfaces, dark navy text, blue (`#2F7CF7`) as the UI accent for icons, links, and active controls. The DFX brand red (`#F5516C`) is preserved as `DfxColors.brandRed` for the logo only.
- **Dashboard**: full-screen mountain-illustration background (`assets/dashboard-bg.png`), DFX logo header + hamburger menu, large balance display with eye-toggle, Portfolio + Pay pill buttons, Transactions link, and a bottom Receive | Send pill. Buy and Sell are reached from inside the Receive and Send flows respectively.
- **Onboarding flow**: Welcome → Create/Restore (passkey or seed) → Verify Seed → Legal → PIN → Dashboard
- **Settings**: reached from the Dashboard hamburger menu (no bottom tab bar). Flat list with sub-pages.
- **KYC**: Multi-step wizard (Registration → Email → Nationality → Financial Data → 2FA → Ident)

## Supported Blockchains (via WDK)

- Bitcoin On-Chain (`wdk-wallet-btc`)
- Ethereum + L2s: Arbitrum, Polygon, Optimism, Base (`wdk-wallet-evm`)
- Solana (`wdk-wallet-solana`)
- TON (`wdk-wallet-ton`)
- TRON (`wdk-wallet-tron`)
- Spark / Lightning (`wdk-wallet-spark`)

## Hardware Wallet Support — CRITICAL

BitBox02 integration is a MUST-HAVE requirement.

**Dual-transport architecture:**

- **USB HID** — Standard BitBox02, **Android only** (Apple blocks USB-HID for 3rd party apps)
- **BLE** — BitBox02 Nova, **Android + iOS**
- View-only wallet model: no seed stored locally, signing delegated to hardware

**SDK:** `bitbox-api` (npm, v0.12.0, WASM from BitBoxSwiss/bitbox-api-rs)

- Protocol stack (Noise XX handshake, Protobuf, signing) is transport-agnostic
- Only the ReadWrite transport layer needs native implementation

**Implementation**: `src/services/hardware-wallet/`

- `types.ts` — `HardwareWalletProvider`, `BitboxTransport` interfaces
- `bitbox.ts` — `BitboxProvider` (scans USB + BLE, auto-selects transport)
- `transport-usb.ts` — Android native HID module (pattern: `@ledgerhq/react-native-hid`)
- `transport-ble.ts` — BLE via `react-native-ble-plx` (Android + iOS)

**Connection flow:** Scan (USB+BLE) → Detect → Connect → Noise handshake → Channel Verify → Get Address

**Signing:** BTC (SegWit, Taproot, PSBT) + ETH (EIP-1559, ERC-20, EIP-712)

**RealUnit reference files** (Flutter, useful as a reference for the signing flow):

- `lib/screens/hardware_connect_bitbox/` — UI + connection flow
- `lib/packages/hardware_wallet/bitbox_credentials.dart` — signing logic
- `lib/packages/hardware_wallet/bitbox.dart` — service wrapper

## Testing

- **Unit tests**: Jest, co-located with the code they cover
- **E2E**: Maestro (`npm run e2e:maestro`) for cross-platform flows, Detox (`npm run e2e:test:ios`) for iOS-specific scenarios
- Add tests for new business logic in `src/services/` and `src/store/`

## Security

See `SECURITY.md` for the responsible disclosure policy and the security model.

- Never commit secrets, seed phrases, or API keys
- Test fixtures must not contain real wallet credentials
- All secrets in `.env.local` (gitignored)
