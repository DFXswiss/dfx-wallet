import { Redirect } from 'expo-router';

/**
 * Stand-in for every multi-sig route when `EXPO_PUBLIC_ENABLE_MULTISIG`
 * is off. Pulls in nothing beyond `expo-router` — no Zustand store, no
 * MMKV, no vault types — so the disabled-path's surface stays tiny.
 *
 * Both `multi-sig/index.tsx` and `multi-sig/setup.tsx` route through
 * this same disabled component; bouncing the user back to the
 * dashboard is the right behavior for either of them.
 */
export default function MultiSigDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
