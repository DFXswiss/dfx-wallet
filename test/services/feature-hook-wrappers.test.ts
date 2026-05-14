/**
 * Coverage for the `src/hooks/use*.ts` wrappers that pick between a
 * feature-gated implementation and a no-op disabled module at build
 * time. Every consumer that touches these wrappers mocks `@/hooks`, so
 * without these targeted module-load tests the wrappers themselves
 * remain at 0% coverage.
 *
 * Each suite exercises both branches:
 *   - With all relevant feature flags ON  (the test runtime default)
 *   - With every flag OFF (an MVP-mode load)
 */

describe('useDeepLink wrapper', () => {
  it('resolves to the impl module when FEATURES.DEEPLINKS is on', () => {
    jest.isolateModules(() => {
      // Stub both impl + disabled to avoid pulling in expo-linking /
      // expo-router under the unit project (no native bridge available).
      jest.doMock('@/features/deep-link/useDeepLinkImpl', () => ({
        useDeepLink: jest.fn().mockName('useDeepLinkImpl'),
      }));
      jest.doMock('@/features/deep-link/useDeepLinkDisabled', () => ({
        useDeepLink: jest.fn().mockName('useDeepLinkDisabled'),
      }));
      jest.doMock('@/config/features', () => ({ FEATURES: { DEEPLINKS: true } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/hooks/useDeepLink');
      expect((mod.useDeepLink as jest.Mock).getMockName()).toBe('useDeepLinkImpl');
    });
  });

  it('falls back to the disabled no-op when FEATURES.DEEPLINKS is off', () => {
    jest.isolateModules(() => {
      jest.doMock('@/features/deep-link/useDeepLinkImpl', () => ({
        useDeepLink: jest.fn().mockName('useDeepLinkImpl'),
      }));
      jest.doMock('@/features/deep-link/useDeepLinkDisabled', () => ({
        useDeepLink: jest.fn().mockName('useDeepLinkDisabled'),
      }));
      jest.doMock('@/config/features', () => ({ FEATURES: { DEEPLINKS: false } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/hooks/useDeepLink');
      expect((mod.useDeepLink as jest.Mock).getMockName()).toBe('useDeepLinkDisabled');
    });
  });
});

describe('useDfxAutoLink wrapper', () => {
  it('resolves to the impl module when FEATURES.DFX_BACKEND is on', () => {
    jest.isolateModules(() => {
      jest.doMock('@/features/dfx-backend/useDfxAutoLinkImpl', () => ({
        useDfxAutoLink: jest.fn().mockName('useDfxAutoLinkImpl'),
        markChainLinkedInAutoLinkCache: jest.fn().mockName('markCacheImpl'),
      }));
      jest.doMock('@/features/dfx-backend/useDfxAutoLinkDisabled', () => ({
        useDfxAutoLink: jest.fn().mockName('useDfxAutoLinkDisabled'),
      }));
      jest.doMock('@/config/features', () => ({ FEATURES: { DFX_BACKEND: true } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/hooks/useDfxAutoLink');
      expect((mod.useDfxAutoLink as jest.Mock).getMockName()).toBe('useDfxAutoLinkImpl');
      expect((mod.markChainLinkedInAutoLinkCache as jest.Mock).getMockName()).toBe('markCacheImpl');
    });
  });

  it('falls back to disabled + no-op cache helper when FEATURES.DFX_BACKEND is off', () => {
    jest.isolateModules(() => {
      jest.doMock('@/features/dfx-backend/useDfxAutoLinkImpl', () => ({
        useDfxAutoLink: jest.fn().mockName('useDfxAutoLinkImpl'),
        markChainLinkedInAutoLinkCache: jest.fn().mockName('markCacheImpl'),
      }));
      jest.doMock('@/features/dfx-backend/useDfxAutoLinkDisabled', () => ({
        useDfxAutoLink: jest.fn().mockName('useDfxAutoLinkDisabled'),
      }));
      jest.doMock('@/config/features', () => ({ FEATURES: { DFX_BACKEND: false } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/hooks/useDfxAutoLink');
      expect((mod.useDfxAutoLink as jest.Mock).getMockName()).toBe('useDfxAutoLinkDisabled');
      // The cache helper collapses to an inline `() => undefined`.
      expect(mod.markChainLinkedInAutoLinkCache('ethereum')).toBeUndefined();
    });
  });
});

describe('useLdsWallet wrapper', () => {
  it('resolves to the impl module when FEATURES.DFX_BACKEND is on', () => {
    jest.isolateModules(() => {
      jest.doMock('@/features/dfx-backend/useLdsWalletImpl', () => ({
        useLdsWallet: jest.fn().mockName('useLdsWalletImpl'),
      }));
      jest.doMock('@/features/dfx-backend/useLdsWalletDisabled', () => ({
        useLdsWallet: jest.fn().mockName('useLdsWalletDisabled'),
      }));
      jest.doMock('@/config/features', () => ({ FEATURES: { DFX_BACKEND: true } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/hooks/useLdsWallet');
      expect((mod.useLdsWallet as jest.Mock).getMockName()).toBe('useLdsWalletImpl');
    });
  });

  it('falls back to the disabled hook when FEATURES.DFX_BACKEND is off', () => {
    jest.isolateModules(() => {
      jest.doMock('@/features/dfx-backend/useLdsWalletImpl', () => ({
        useLdsWallet: jest.fn().mockName('useLdsWalletImpl'),
      }));
      jest.doMock('@/features/dfx-backend/useLdsWalletDisabled', () => ({
        useLdsWallet: jest.fn().mockName('useLdsWalletDisabled'),
      }));
      jest.doMock('@/config/features', () => ({ FEATURES: { DFX_BACKEND: false } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/hooks/useLdsWallet');
      expect((mod.useLdsWallet as jest.Mock).getMockName()).toBe('useLdsWalletDisabled');
    });
  });
});
