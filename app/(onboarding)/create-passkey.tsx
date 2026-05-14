import { FEATURES } from '@/config/features';

/**
 * Passkey create route entry. With `EXPO_PUBLIC_ENABLE_PASSKEY` off
 * the welcome screen hides the passkey button, so this route is
 * unreachable from the UI. The disabled stub stays as a safety net for
 * deep-link / file-system entry.
 *
 * Pulls in `react-native-passkey`, HKDF derivation and the WDK
 * `restoreWallet` import only when the flag is on.
 */
const CreatePasskeyScreen = FEATURES.PASSKEY
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/passkey/CreatePasskeyScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/passkey/PasskeyDisabled').default as React.ComponentType);

export default CreatePasskeyScreen;
