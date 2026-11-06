import { Redirect } from 'expo-router';

/**
 * Stand-in for the Settings hub and the screens it owns (seed export
 * etc.) when `EXPO_PUBLIC_ENABLE_SETTINGS` is off. Pulls in nothing
 * beyond `expo-router` — no DFX user-service sync, no `dfxApi`, no
 * passkey re-auth pipeline.
 *
 * The dashboard hides the hamburger button when the flag is off so
 * this stub is the safety net for deep-links into `/settings` or
 * `/(auth)/seed-export`.
 */
export default function SettingsDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
