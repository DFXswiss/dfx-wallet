import { FEATURES } from '@/config/features';

/**
 * Public `useLdsWallet` wrapper. With `EXPO_PUBLIC_ENABLE_DFX_BACKEND`
 * off, the LDS client is not part of the bundle and the hook returns
 * an empty state — Lightning receive simply isn't available in the MVP.
 */
const useLdsWallet = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/useLdsWalletImpl').useLdsWallet
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/useLdsWalletDisabled').useLdsWallet;

export { useLdsWallet };
