import { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BITBOX_WASM_HTML } from './bitbox-wasm-html';
import type { WasmBridge } from './wasm-bridge';

type Props = {
  bridge: WasmBridge;
  onReady?: () => void;
};

/**
 * Hidden WebView that runs the bitbox-api WASM module.
 *
 * Mount this component when BitBox02 hardware wallet features are needed.
 * It loads the WASM binary (inline base64) and exposes the BitBox API
 * via the WasmBridge RPC protocol.
 *
 * Architecture:
 *   React Native ←→ WasmBridge (postMessage) ←→ WebView (WASM) ←→ BitBox02
 *       ↑                                              ↑
 *   USB/BLE Transport ←←←←←← transport_write/read ←←←←←
 */
export function BitboxWasmWebView({ bridge, onReady }: Props) {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;

      try {
        const msg = JSON.parse(data);

        if (msg.type === 'ready') {
          onReady?.();
          return;
        }

        if (msg.type === 'error') {
          return;
        }
      } catch {
        // Not JSON, ignore
      }

      bridge.onMessage(data);
    },
    [bridge, onReady],
  );

  useEffect(() => {
    if (webViewRef.current) {
      bridge.setWebView({
        postMessage: (msg: string) => {
          webViewRef.current?.injectJavaScript(
            `document.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} })); true;`,
          );
        },
      });
    }

    return () => {
      bridge.destroy();
    };
  }, [bridge]);

  return (
    <View style={styles.hidden}>
      <WebView
        ref={webViewRef}
        source={{ html: BITBOX_WASM_HTML }}
        onMessage={handleMessage}
        javaScriptEnabled
        originWhitelist={['*']}
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
