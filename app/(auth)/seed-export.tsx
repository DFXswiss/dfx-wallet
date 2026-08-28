import { FEATURES } from '@/config/features';

/**
 * Seed-export route. Companion to the Settings hub; gated by the
 * same flag and shares the disabled stub. Pulls in the WDK
 * `useWalletManager`, the optional passkey re-auth chain and the
 * `expo-screen-capture` soft-import only when the flag is on.
 */
const SeedExportScreen = FEATURES.SETTINGS
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/settings/SeedExportScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/settings/SettingsDisabled').default as React.ComponentType);

export default SeedExportScreen;
