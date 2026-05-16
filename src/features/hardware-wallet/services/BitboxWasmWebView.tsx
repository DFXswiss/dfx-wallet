import { useRef, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { renderBridgeHtml } from './bridge-html';
import type { WasmBridge } from './wasm-bridge';

type Props = {
  bridge: WasmBridge;
  onReady?: () => void;
};

/**
 * Hidden WebView that hosts the bitbox-api WASM and proxies its API back
 * to React Native via the WasmBridge protocol.
 *
 * Architecture:
 *
 *   React Native ◄──postMessage──► WebView (WASM)
 *        ▲                              ▲
 *   USB/BLE Transport ─transport_write/read─┘
 *
 * Security:
 *
 *   - The HTML is rendered with the bridge's current session nonce baked
 *     in. The WebView's message handler checks every inbound message
 *     against that nonce.
 *   - originWhitelist is locked to about:blank exactly — no wildcard, no
 *     remote origins. The bitbox-api WASM blob must come from the app
 *     bundle (configured via scripts/setup-bitbox-wasm.sh).
 *   - Native→WebView messaging uses `WebView.postMessage` (which the
 *     page receives via `window.addEventListener('message', ...)`),
 *     NOT `injectJavaScript`. The previous template-literal injection
 *     was a latent XSS sink whenever a non-byte-array payload (an
 *     error echo, a channel-hash string) was added to the protocol.
 *   - The CSP in bridge-html drops 'unsafe-eval' for 'wasm-unsafe-eval',
 *     drops style-src 'unsafe-inline', adds frame-ancestors 'none',
 *     worker-src 'none', media-src 'none'. Defence in depth even if
 *     the WASM blob is ever tampered with.
 *   - File-URL escape props are explicitly off (allowFileAccessFromFileURLs,
 *     allowUniversalAccessFromFileURLs); domStorage and third-party
 *     cookies are off so nothing persists across the WebView's lifetime.
 */
export function BitboxWasmWebView({ bridge, onReady }: Props) {
  const webViewRef = useRef<WebView>(null);

  // The HTML is parameterised on the session nonce. Re-render when the
  // bridge re-binds to a new session — the new HTML carries the new nonce.
  const html = useMemo(() => renderBridgeHtml(bridge.getSessionNonce()), [bridge]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;
      // Pre-parse only enough to spot wasm_ready markers we want to
      // surface to the caller. The bridge's own onMessage runs the strict
      // nonce check and dispatch; we ALSO verify the nonce here so a
      // foreign window with the right shape but the wrong nonce cannot
      // flip our local readiness state.
      try {
        const msg = JSON.parse(data);
        if (msg && msg.type === 'wasm_ready' && msg.nonce === bridge.getSessionNonce()) {
          onReady?.();
        }
      } catch {
        // Not JSON — could be a probe or noise. Pass through to the bridge.
      }
      bridge.onMessage(data);
    },
    [bridge, onReady],
  );

  useEffect(() => {
    if (!webViewRef.current) return;
    bridge.setWebView({
      postMessage: (msg: string) => {
        // react-native-webview's typed `postMessage` dispatches the
        // string as a `message` event in the page (consumed by
        // window.addEventListener('message', ...)). No `eval`, no
        // string-template injection — JSON-stringified payloads are
        // delivered byte-exact via the native bridge channel.
        webViewRef.current?.postMessage(msg);
      },
    });
    return () => {
      bridge.destroy();
    };
  }, [bridge]);

  return (
    <View style={styles.hidden}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        // Exactly about:blank — no wildcard. The page imports its WASM
        // asset via a relative URL; no remote origins must ever be
        // reachable from this hidden WebView.
        originWhitelist={['about:blank']}
        // Bridge-side defence-in-depth: a hostile page that somehow loads
        // cannot navigate elsewhere.
        allowsBackForwardNavigationGestures={false}
        allowsInlineMediaPlayback={false}
        cacheEnabled={false}
        // iOS-only — Android equivalents are the explicit props below.
        incognito
        // Reject file:// escapes on Android; the bridge has no business
        // reading the device's filesystem.
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        // Refuse any mixed-content fetch; we make none, but defence in
        // depth covers a future contributor adding a CSP-bypass fetch.
        mixedContentMode="never"
        // No DOM storage / IndexedDB / WebSQL — the bridge holds no
        // state worth persisting between sessions.
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    width: 0,
    height: 0,
    overflow: 'hidden',
    position: 'absolute',
  },
  webview: {
    width: 0,
    height: 0,
  },
});
