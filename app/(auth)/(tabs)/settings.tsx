import { FEATURES } from '@/config/features';

/**
 * Settings hub route. Resolves at build time to either the real
 * `SettingsScreenImpl` (which pulls in the DFX user service, the
 * biometric toggle, hardware-wallet pairing entry, and the seed export
 * navigation) or a `<Redirect>` stub.
 */
const SettingsScreen = FEATURES.SETTINGS
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/settings/SettingsScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/settings/SettingsDisabled').default as React.ComponentType);

export default SettingsScreen;
