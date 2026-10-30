import { FEATURES } from '@/config/features';

/**
 * Restore-wallet route entry. With `EXPO_PUBLIC_ENABLE_RESTORE` off,
 * the welcome screen hides the "restore from seed" affordance, so this
 * route is unreachable from the UI. The disabled stub stays here as a
 * safety net for deep-links and a future-proof file-system entry.
 */
const RestoreWalletScreen = FEATURES.RESTORE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/restore/RestoreWalletScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/restore/RestoreDisabled').default as React.ComponentType);

export default RestoreWalletScreen;
