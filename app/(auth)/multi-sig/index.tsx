import { FEATURES } from '@/config/features';

/**
 * Multi-sig vault management route. See `app/(auth)/pay/index.tsx` for
 * the same pattern: the file stays put because Expo Router demands it,
 * but the body resolves to one of two siblings at build time so a
 * production build with the flag off does not load the Zustand store,
 * the MMKV instance it opens, or the screen's translation surface.
 */
const MultiSigManageScreen = FEATURES.MULTISIG
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/multi-sig/MultiSigManageScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/multi-sig/MultiSigDisabled').default as React.ComponentType);

export default MultiSigManageScreen;
