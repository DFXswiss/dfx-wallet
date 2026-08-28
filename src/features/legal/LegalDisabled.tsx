import { Redirect } from 'expo-router';

/**
 * Stand-in for every legal route when `EXPO_PUBLIC_ENABLE_LEGAL` is off.
 * Pulls in nothing beyond `expo-router` — no `Linking` for external URLs,
 * no allow-list lookup, no translation chains. The onboarding flow
 * conditionally skips the disclaimer step when this flag is off (see
 * `setup-pin.tsx`), so a navigation that still lands on
 * `/(onboarding)/legal-disclaimer` (e.g. a deep link) bounces to the
 * dashboard rather than to a broken screen.
 */
export default function LegalDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
