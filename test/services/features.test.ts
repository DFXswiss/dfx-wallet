import { FEATURES } from '../../src/config/features';

describe('FEATURES', () => {
  it('reports every flag as false when no EXPO_PUBLIC_ENABLE_* env var is set', () => {
    // Jest does not run through Expo's build-time inlining of
    // `process.env.EXPO_PUBLIC_*`, so this smoke test only validates the
    // "unset → false" default that every Node runtime sees. The actual
    // build-time DCE behavior is verified separately by inspecting the
    // Metro bundle output (no `XScreenImpl` symbols when the flag is off).
    for (const value of Object.values(FEATURES)) {
      expect(value).toBe(false);
    }
  });

  it('lists exactly the flags documented in the README', () => {
    // Keep this in lockstep with the "Feature flags" table in README.md.
    // Adding a flag here without updating the README (or vice versa)
    // means the matrix is lying about what the build can disable.
    expect(Object.keys(FEATURES).sort()).toEqual([
      'BIOMETRIC',
      'BUY_SELL',
      'DEEPLINKS',
      'DFX_BACKEND',
      'HARDWARE_WALLET',
      'LEGAL',
      'LINKED_WALLETS',
      'MULTISIG',
      'PASSKEY',
      'PAY',
      'PIN',
      'PORTFOLIO',
      'RESTORE',
      'SETTINGS',
      'TAX_REPORT',
      'TX_HISTORY',
      'WEBVIEW',
    ]);
  });
});
