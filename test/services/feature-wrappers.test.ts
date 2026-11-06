/**
 * Verify the conditional-`require()` wrappers around deferred features
 * resolve to the *disabled* sibling under the unit-test runtime — even
 * though `setup-globals.ts` flips every `EXPO_PUBLIC_ENABLE_*` to "true"
 * by default, we override the env per test below and reload the module.
 *
 * The disabled sibling is what an MVP build sees, and its contract is
 * "do nothing, surface the empty state". Locking that down here means a
 * future refactor of any wrapper cannot silently change the MVP behavior.
 */

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

async function withAllFlagsOff<T>(fn: () => T | Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of FEATURE_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('feature-flag wrappers (all flags off → MVP build)', () => {
  it('useDeepLink resolves to a no-op (no listener, no router subscription)', async () => {
    await withAllFlagsOff(() => {
      let mod: typeof import('../../src/hooks/useDeepLink') | undefined;
      jest.isolateModules(() => {
        mod = require('../../src/hooks/useDeepLink');
      });
      expect(mod).toBeDefined();
      // Calling the disabled hook outside a React render still has to not
      // throw — useEffect / useState aren't used by the no-op variant.
      expect(() => mod!.useDeepLink()).not.toThrow();
    });
  });

  it('useDfxAuth resolves to a no-op API with the same return shape', async () => {
    await withAllFlagsOff(async () => {
      let mod: typeof import('../../src/hooks/useDfxAuth') | undefined;
      jest.isolateModules(() => {
        mod = require('../../src/hooks/useDfxAuth');
      });
      const api = mod!.useDfxAuth();
      expect(api.isAuthenticating).toBe(false);
      expect(api.error).toBeNull();
      await expect(api.authenticate()).resolves.toBe(false);
      await expect(api.authenticateSilent()).resolves.toBe(false);
      await expect(api.reauthenticateAsOwner()).resolves.toBe(false);
      await expect(api.logout()).resolves.toBeUndefined();
    });
  });

  it('useDfxAutoLink resolves to a void no-op', async () => {
    await withAllFlagsOff(() => {
      let mod: typeof import('../../src/hooks/useDfxAutoLink') | undefined;
      jest.isolateModules(() => {
        mod = require('../../src/hooks/useDfxAutoLink');
      });
      expect(() => mod!.useDfxAutoLink()).not.toThrow();
      // `markChainLinkedInAutoLinkCache` collapses to () => undefined.
      expect(mod!.markChainLinkedInAutoLinkCache('bitcoin')).toBeUndefined();
    });
  });

  it('useLdsWallet resolves to an empty LDS state', async () => {
    await withAllFlagsOff(async () => {
      let mod: typeof import('../../src/hooks/useLdsWallet') | undefined;
      jest.isolateModules(() => {
        mod = require('../../src/hooks/useLdsWallet');
      });
      const lds = mod!.useLdsWallet();
      expect(lds.user).toBeNull();
      expect(lds.isLoading).toBe(false);
      expect(lds.error).toBeNull();
      await expect(lds.signIn()).resolves.toBeUndefined();
    });
  });
});

describe('feature-flag wrappers (all flags on → full build)', () => {
  // setup-globals.ts already pins every flag to "true" in the unit
  // runtime, so just reloading the wrapper resolves to the real impl.
  // We don't invoke the real impls here (they need React + WDK) — we
  // only assert that the wrapper picks the non-no-op branch by
  // checking the function's source signature differs from the disabled
  // ones (the disabled hook of useDfxAuth returns a constant, while
  // the real one runs a useEffect-heavy implementation).
  it('useDfxAuth picks the real implementation when DFX_BACKEND is on', () => {
    let realMod: typeof import('../../src/hooks/useDfxAuth') | undefined;
    let disabledImpl: typeof import('../../src/features/dfx-backend/useDfxAuthDisabled') | undefined;
    jest.isolateModules(() => {
      realMod = require('../../src/hooks/useDfxAuth');
      disabledImpl = require('../../src/features/dfx-backend/useDfxAuthDisabled');
    });
    // The two functions must be distinct references when the flag is on.
    expect(realMod!.useDfxAuth).not.toBe(disabledImpl!.useDfxAuth);
  });
});
