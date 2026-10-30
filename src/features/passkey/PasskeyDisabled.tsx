import { Redirect } from 'expo-router';

/**
 * Stand-in for the passkey-create and passkey-restore routes when
 * `EXPO_PUBLIC_ENABLE_PASSKEY` is off. Pulls in nothing beyond
 * `expo-router` — no `react-native-passkey`, no HKDF / BIP-39 derivation,
 * no WDK `restoreWallet` import. The welcome screen hides the passkey
 * affordances when the flag is off, so deep-link is the only way to
 * reach this stub.
 */
export default function PasskeyDisabled() {
  return <Redirect href="/(onboarding)/welcome" />;
}
