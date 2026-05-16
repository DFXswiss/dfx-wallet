import { FEATURES } from '@/config/features';

/**
 * PIN-setup onboarding route. With `EXPO_PUBLIC_ENABLE_PIN` off the
 * disabled stub silently marks onboarding complete and replaces to
 * the dashboard — the MVP build does not gate the wallet behind a PIN.
 */
const SetupPinScreen = FEATURES.PIN
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/pin/SetupPinScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/pin/SetupPinDisabled').default as React.ComponentType);

export default SetupPinScreen;
