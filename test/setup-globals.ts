import { webcrypto } from 'crypto';

// bip39 needs crypto.getRandomValues
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

// Force every deferred feature on for the unit-test runtime. Feature
// flags are read from `process.env.EXPO_PUBLIC_ENABLE_*` at module-load
// time inside `src/config/features.ts`, so the assignment has to
// happen here (in the setupFiles phase) before any test or source
// module is imported. Setting them to 'true' means the conditional
// `require()` wrappers we add around deferred services (e.g. the
// biometric module in the auth store) resolve to the real
// implementation, which is what the existing test suites assume.
const FEATURE_ENV_KEYS = [
  'EXPO_PUBLIC_ENABLE_RESTORE',
  'EXPO_PUBLIC_ENABLE_PASSKEY',
  'EXPO_PUBLIC_ENABLE_LEGAL',
  'EXPO_PUBLIC_ENABLE_PIN',
  'EXPO_PUBLIC_ENABLE_BIOMETRIC',
  'EXPO_PUBLIC_ENABLE_PORTFOLIO',
  'EXPO_PUBLIC_ENABLE_BUY_SELL',
  'EXPO_PUBLIC_ENABLE_LINKED_WALLETS',
  'EXPO_PUBLIC_ENABLE_TX_HISTORY',
  'EXPO_PUBLIC_ENABLE_PAY',
  'EXPO_PUBLIC_ENABLE_DFX_BACKEND',
  'EXPO_PUBLIC_ENABLE_TAX_REPORT',
  'EXPO_PUBLIC_ENABLE_SETTINGS',
  'EXPO_PUBLIC_ENABLE_HARDWARE_WALLET',
  'EXPO_PUBLIC_ENABLE_MULTISIG',
  'EXPO_PUBLIC_ENABLE_DEEPLINKS',
  'EXPO_PUBLIC_ENABLE_WEBVIEW',
];
for (const key of FEATURE_ENV_KEYS) {
  process.env[key] = 'true';
}
