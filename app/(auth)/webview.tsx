import { FEATURES } from '@/config/features';

/**
 * In-app WebView route. Loads external URLs (KYC iframe, payment
 * hand-off) inside a `<WebView>` gated by the `safe-url` allow-list.
 * With `EXPO_PUBLIC_ENABLE_WEBVIEW` off, the route resolves to a tiny
 * stub that redirects to the dashboard — keeping `react-native-webview`
 * and the host allow-list out of the MVP bundle.
 */
const WebViewScreen = FEATURES.WEBVIEW
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/webview/WebViewScreenImpl').default as React.ComponentType)
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/features/webview/WebViewDisabled').default as React.ComponentType);

export default WebViewScreen;
