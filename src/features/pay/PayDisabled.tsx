import { Redirect } from 'expo-router';

/**
 * Stand-in for the Pay screen when `EXPO_PUBLIC_ENABLE_PAY` is off.
 *
 * Pulls in nothing beyond `expo-router` — no `expo-camera`, no
 * `CameraView`, no `useCameraPermissions`, no scanner state. Keeping
 * the disabled path's surface tiny is the whole point: it is the
 * component Metro ships when the feature flag is off, and it must not
 * be a vector for any of the bigger deferred dependencies.
 *
 * A bare `<Redirect>` is enough — the route still exists in the
 * file-system tree (Expo Router requires it), but any navigation into
 * it bounces straight back to the dashboard.
 */
export default function PayDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
