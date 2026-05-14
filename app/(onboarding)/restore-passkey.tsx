import { FEATURES } from '@/config/features';

/**
 * Passkey restore route entry. Companion to `create-passkey.tsx`; both
 * routes are gated by the same flag and share the disabled-path
 * component.
 */
const RestorePasskeyScreen = FEATURES.PASSKEY
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/passkey/RestorePasskeyScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/passkey/PasskeyDisabled').default as React.ComponentType);

export default RestorePasskeyScreen;
