import { FEATURES } from '@/config/features';

/**
 * Public `useDfxAutoLink` wrapper. With `EXPO_PUBLIC_ENABLE_DFX_BACKEND`
 * off, resolves to a no-op so `(auth)/_layout.tsx` can call it
 * unconditionally without pulling the DFX auto-link cache, the LDS
 * client, or the chain-by-chain `linkAddress` calls into the bundle.
 */
const useDfxAutoLink: () => void = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/useDfxAutoLinkImpl').useDfxAutoLink
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/useDfxAutoLinkDisabled').useDfxAutoLink;

export { useDfxAutoLink };

/**
 * Re-export of `markChainLinkedInAutoLinkCache`. The cache lives inside
 * the real auto-link module, so when the flag is off the helper
 * collapses to a no-op (callers come from deferred Buy/Sell flows;
 * if they ever run, the real cache is live too).
 */
export const markChainLinkedInAutoLinkCache: (chain: string) => void = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/useDfxAutoLinkImpl').markChainLinkedInAutoLinkCache
  : () => undefined;
