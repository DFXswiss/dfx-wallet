/**
 * Build-time feature flags for every deferred (non-MVP) function.
 *
 * Each `EXPO_PUBLIC_ENABLE_*` variable is read here against the literal
 * string `'true'`. Expo's `babel-preset-expo` replaces
 * `process.env.EXPO_PUBLIC_*` accesses with the actual string value at
 * build time, so each `FEATURES.X` resolves to a boolean literal in the
 * compiled bundle.
 *
 * Combined with a conditional `require()` at the call site:
 *
 *   const Screen = FEATURES.X
 *     ? require('@/features/x/XScreenImpl').default
 *     : require('@/features/x/XDisabled').default;
 *
 * Metro's dead-code elimination drops the unused branch — a production
 * build with the flag unset will not load, parse, or execute the
 * deferred code. This is the "code-isolation" property the README's
 * Feature-flags section commits to.
 *
 * Always import the named `FEATURES` constant; never re-read
 * `process.env.EXPO_PUBLIC_ENABLE_*` directly elsewhere, otherwise the
 * build-time replacement is harder to audit and DCE may not fire.
 *
 * @see README.md "Feature flags" for the full mapping of flag → functions.
 */
export const FEATURES = {
  RESTORE: process.env.EXPO_PUBLIC_ENABLE_RESTORE === 'true',
  PASSKEY: process.env.EXPO_PUBLIC_ENABLE_PASSKEY === 'true',
  LEGAL: process.env.EXPO_PUBLIC_ENABLE_LEGAL === 'true',
  PIN: process.env.EXPO_PUBLIC_ENABLE_PIN === 'true',
  BIOMETRIC: process.env.EXPO_PUBLIC_ENABLE_BIOMETRIC === 'true',
  PORTFOLIO: process.env.EXPO_PUBLIC_ENABLE_PORTFOLIO === 'true',
  BUY_SELL: process.env.EXPO_PUBLIC_ENABLE_BUY_SELL === 'true',
  LINKED_WALLETS: process.env.EXPO_PUBLIC_ENABLE_LINKED_WALLETS === 'true',
  TX_HISTORY: process.env.EXPO_PUBLIC_ENABLE_TX_HISTORY === 'true',
  PAY: process.env.EXPO_PUBLIC_ENABLE_PAY === 'true',
  DFX_BACKEND: process.env.EXPO_PUBLIC_ENABLE_DFX_BACKEND === 'true',
  TAX_REPORT: process.env.EXPO_PUBLIC_ENABLE_TAX_REPORT === 'true',
  SETTINGS: process.env.EXPO_PUBLIC_ENABLE_SETTINGS === 'true',
  HARDWARE_WALLET: process.env.EXPO_PUBLIC_ENABLE_HARDWARE_WALLET === 'true',
  MULTISIG: process.env.EXPO_PUBLIC_ENABLE_MULTISIG === 'true',
  DEEPLINKS: process.env.EXPO_PUBLIC_ENABLE_DEEPLINKS === 'true',
  WEBVIEW: process.env.EXPO_PUBLIC_ENABLE_WEBVIEW === 'true',
} as const;

export type FeatureFlag = keyof typeof FEATURES;
