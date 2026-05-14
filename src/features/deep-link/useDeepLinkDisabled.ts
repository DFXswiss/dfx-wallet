/**
 * No-op stand-in for the deep-link handler when
 * `EXPO_PUBLIC_ENABLE_DEEPLINKS` is off. Same signature as the real
 * hook so the call site in `(auth)/_layout.tsx` does not need to branch.
 *
 * Pulls in nothing — no `expo-linking`, no router subscription, no
 * `Linking.getInitialURL()` round-trip — so a production build with
 * the flag off cannot register a URL listener that might fire from a
 * malicious `dfxwallet://` payload.
 */
export function useDeepLink(): void {
  // intentionally empty
}
