import { FEATURES } from '@/config/features';

/**
 * Public `useDfxAuth` re-export. Resolves at build time to either the
 * real implementation in `@/features/dfx-backend/useDfxAuthImpl` or a
 * no-op stub in `useDfxAuthDisabled`. The no-op preserves the return
 * shape so callers (notably the dashboard auto-auth `useEffect`)
 * compile without changes.
 *
 * With `EXPO_PUBLIC_ENABLE_DFX_BACKEND` off, Metro's dead-code
 * elimination drops the real module from the bundle: no `dfxApi`, no
 * `dfxAuthService`, no JWT round-trip, no signing prompt.
 */
const useDfxAuth = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/useDfxAuthImpl').useDfxAuth
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/useDfxAuthDisabled').useDfxAuth;

export { useDfxAuth };
