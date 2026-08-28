import { FEATURES } from '@/config/features';

/**
 * Public `useDeepLink` re-export. Resolves to one of two siblings under
 * `src/features/deep-link/` at build time via the conditional `require()`:
 *
 *   - `useDeepLinkImpl`     — the real handler, registers a URL listener
 *                             and routes `dfxwallet://buy|sell|send|…`
 *                             paths to the corresponding screen.
 *   - `useDeepLinkDisabled` — a no-op hook, registers nothing.
 *
 * The call site in `app/(auth)/_layout.tsx` invokes `useDeepLink()`
 * unconditionally — the conditional resolution happens here so React's
 * rules-of-hooks are not violated, while Metro's dead-code elimination
 * can still drop the unused branch from the bundle.
 */
const useDeepLink: () => void = FEATURES.DEEPLINKS
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/deep-link/useDeepLinkImpl').useDeepLink
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/deep-link/useDeepLinkDisabled').useDeepLink;

export { useDeepLink };
