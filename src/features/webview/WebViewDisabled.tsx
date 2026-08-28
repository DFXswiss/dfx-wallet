import { Redirect } from 'expo-router';

/**
 * Stand-in for the in-app WebView route when `EXPO_PUBLIC_ENABLE_WEBVIEW`
 * is off. Pulls in nothing beyond `expo-router` — no `react-native-webview`,
 * no DFX-host allow-list, no JWT injection.
 *
 * With the flag off, the WebView surface is intentionally absent from
 * the bundle. KYC and other deferred features that depend on it stay
 * unreachable unless their own flags are also on, but should they
 * somehow be reached, they would route into this stub instead of
 * loading an arbitrary URL inside an unprotected `<WebView>`.
 */
export default function WebViewDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
