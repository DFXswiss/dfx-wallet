import { Redirect } from 'expo-router';

/**
 * Stand-in for restore routes when `EXPO_PUBLIC_ENABLE_RESTORE` is off.
 * Pulls in nothing beyond `expo-router` — no `bip39` validation, no
 * WDK `restoreWallet` call, no seed-quiz state machine. A user that
 * deep-links into `/(onboarding)/restore-wallet` bounces back to the
 * welcome screen.
 */
export default function RestoreDisabled() {
  return <Redirect href="/(onboarding)/welcome" />;
}
