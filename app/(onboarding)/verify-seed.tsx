import { FEATURES } from '@/config/features';

/**
 * Verify-seed (post-create quiz) route. Currently not part of the
 * active onboarding flow — `create-wallet.tsx` jumps straight to
 * `setup-pin`, so this screen is only reachable via deep-link. Still
 * deferred for code-isolation regardless.
 */
const VerifySeedScreen = FEATURES.RESTORE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/restore/VerifySeedScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/restore/RestoreDisabled').default as React.ComponentType);

export default VerifySeedScreen;
