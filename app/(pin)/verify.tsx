import { FEATURES } from '@/config/features';

/**
 * PIN-unlock route. With `EXPO_PUBLIC_ENABLE_PIN` off the disabled
 * stub unlocks the WDK wallet and flips `isAuthenticated` so the
 * auth-layout's hard gate resolves immediately, with no PIN entry
 * and no biometric prompt.
 */
const VerifyPinScreen = FEATURES.PIN
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/pin/VerifyPinScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/pin/VerifyPinDisabled').default as React.ComponentType);

export default VerifyPinScreen;
