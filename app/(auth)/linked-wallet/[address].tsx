import { FEATURES } from '@/config/features';

/**
 * Linked-wallet detail screen entry (per-address holdings + tx feed).
 * With `EXPO_PUBLIC_ENABLE_LINKED_WALLETS` off, resolves to a
 * `<Redirect>` stub.
 */
const LinkedWalletDetailScreen = FEATURES.LINKED_WALLETS
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/linked-wallets/LinkedWalletDetailScreenImpl')
      .default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/linked-wallets/LinkedWalletsDisabled').default as React.ComponentType);

export default LinkedWalletDetailScreen;
