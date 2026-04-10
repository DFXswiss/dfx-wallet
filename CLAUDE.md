# DFX Wallet — Claude Code Guidelines

## Build & Run

```bash
npm install
npx expo start                     # dev server
npx expo start --ios               # iOS simulator
npx expo start --android           # Android emulator
npx expo prebuild --clean          # generate native projects
npm run typecheck                  # TypeScript check
npm run lint                       # ESLint
```

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
  store/                           # Zustand stores
  theme/                           # Colors, typography
```

## Supported Blockchains (via WDK)

- Bitcoin On-Chain (wdk-wallet-btc)
- Ethereum + L2s: Arbitrum, Polygon, Optimism, Base (wdk-wallet-evm)
- Solana (wdk-wallet-solana)
- TON (wdk-wallet-ton)
- TRON (wdk-wallet-tron)
- Spark/Lightning (wdk-wallet-spark)

## Hardware Wallet Support — CRITICAL

BitBox02 integration is a MUST-HAVE requirement.

**Architecture** (mirrored from RealUnit app):
- USB connection only (no Bluetooth)
- View-only wallet model: no seed stored locally, signing delegated to hardware
- Connection flow: Scan USB → Detect → Connect → Init → Channel Verify → Get Address
- Signing: EVM transactions (EIP1559) + personal messages
- Note: EIP-712 typed signing is NOT supported on BitBox02

**Implementation**: `src/services/hardware-wallet/`
- `types.ts` — `HardwareWalletProvider` interface
- `bitbox.ts` — `BitboxProvider` (TODO: implement via bitbox02-api-js or native module)

**RealUnit reference files**:
- `lib/screens/hardware_connect_bitbox/` — UI + connection flow
- `lib/packages/hardware_wallet/bitbox_credentials.dart` — signing logic
- `lib/packages/hardware_wallet/bitbox.dart` — service wrapper

## Design Reference

UI/UX flows are based on the RealUnit app (`DFXswiss/realunit-app`). Key patterns:
- Dark theme, DFX brand colors (primary: #F5516C)
- Onboarding: Welcome → Create/Restore → Verify Seed → Legal → PIN → Dashboard
- Dashboard: Balance card, action bar (Buy/Sell/Send/Receive), portfolio list
- Settings: Flat list with sub-pages
- KYC: Multi-step wizard (Registration → Email → Nationality → Financial Data → 2FA → Ident)

## Styling — CRITICAL

- **Colors**: Always use `DfxColors.*` from `src/theme/colors.ts`. NEVER use raw hex values or RN defaults.
- **Typography**: Always use `Typography.*` from `src/theme/typography.ts`. NEVER hardcode font sizes.
- **Loading**: Use RN `ActivityIndicator` — no third-party spinners.

## Localization (i18n)

- Source files: `src/i18n/locales/de.json` and `en.json`
- Keys are nested by feature: `dashboard.title`, `buy.title`, etc.
- Keys MUST be alphabetically sorted within each namespace.
- Always update BOTH de and en files.

## Code Conventions

- Prefer functional components with hooks
- State management: Zustand stores in `src/store/`
- API calls: through `src/services/dfx/api.ts`
- DTOs: `src/services/dfx/dto/` with explicit types (no `any`)
- Imports: use `@/` path alias for `src/`
- Imports order: react → react-native → expo → third-party → @/ local
- No `console.log` in committed code
- No unused imports
