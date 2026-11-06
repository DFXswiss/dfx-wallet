import { FEATURES } from '../../src/config/features';

describe('FEATURES', () => {
  it('reports every flag as true under the test runtime', () => {
    // `test/setup-globals.ts` sets every `EXPO_PUBLIC_ENABLE_*` env var
    // to `'true'` before any module loads, so the conditional `require()`
    // wrappers around deferred services resolve to the real
    // implementation under unit-test conditions. This asserts that
    // mapping holds — if a new flag is added to FEATURES and forgotten
    // in the env-key list, this test catches it.
    for (const value of Object.values(FEATURES)) {
      expect(value).toBe(true);
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
