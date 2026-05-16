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
 *   - originWhitelist is restricted to about:blank — no remote origins
 *     can be loaded into this hidden WebView. The bitbox-api WASM blob
 *     must come from the app bundle (configured via scripts/setup-bitbox-wasm.sh).
 *   - injectedJavaScriptBeforeContentLoaded plants the session nonce
 *     into a JS constant BEFORE the page script runs, so the page-level
 *     compare cannot be raced by a hostile message before init.
 */
export function BitboxWasmWebView({ bridge, onReady }: Props) {
  const webViewRef = useRef<WebView>(null);

  // The HTML is parameterised on the session nonce. Re-render when the
  // bridge re-binds to a new session — the new HTML carries the new nonce.
  const html = useMemo(() => renderBridgeHtml(bridge.getSessionNonce()), [bridge]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;
      // Pre-parse only enough to spot wasm_ready / wasm_error markers we
      // want to surface to the caller. The bridge's own onMessage runs the
      // strict nonce check and dispatch.
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'wasm_ready') onReady?.();
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
        // injectJavaScript dispatches a real MessageEvent so addEventListener
        // 'message' picks it up in the page. JSON.stringify is used twice:
        // once by us (msg is already JSON), once by injectJavaScript to
        // embed the JSON as a JS string literal.
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} })); true;`,
        );
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
        // Only the about:blank origin (the inline-HTML page itself).
        // The page imports its WASM asset via a relative URL — no remote
        // origins must ever be reachable from this hidden WebView.
        originWhitelist={['about:*']}
        // Bridge-side defence-in-depth: a hostile page that somehow loads
        // cannot navigate elsewhere.
        allowsBackForwardNavigationGestures={false}
        allowsInlineMediaPlayback={false}
        cacheEnabled={false}
        incognito
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
