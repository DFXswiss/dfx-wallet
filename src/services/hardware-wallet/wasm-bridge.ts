/**
 * WebView WASM Bridge for bitbox-api.
 *
 * Strategy: Run bitbox-api WASM inside a hidden WebView (which has native
 * WASM support via WKWebView/Chrome). Communicate between React Native
 * and the WebView via postMessage/onMessage.
 *
 * Architecture:
 * ┌─────────────────────┐         ┌──────────────────────────┐
 * │  React Native       │ ◄─────► │  Hidden WebView          │
 * │  (BitboxProvider)   │  JSON   │  (bitbox-api WASM)       │
 * │                     │  msgs   │                          │
 * │  USB/BLE Transport ─┼─────────┼→ Custom ReadWrite impl   │
 * └─────────────────────┘         └──────────────────────────┘
 *
 * Message protocol:
 *   RN → WebView:  { id, method, params }
 *   WebView → RN:  { id, result } | { id, error }
 *   WebView → RN:  { type: 'transport_write', data }  (transport callback)
 *   RN → WebView:  { type: 'transport_read_response', data }
 *
 * The WebView loads a minimal HTML page that:
 * 1. Imports bitbox-api WASM
 * 2. Implements a custom transport that bridges to RN's USB/BLE transport
 * 3. Exposes PairedBitBox methods via the message protocol
 *
 * TODO: Implementation requires:
 * - react-native-webview dependency
 * - Bundling bitbox_api_bg.wasm as a WebView asset
 * - HTML page with the bridge JavaScript
 * - Message queue for async request/response matching
 */

type PendingCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

export class WasmBridge {
  private callId = 0;
  private pending = new Map<number, PendingCall>();
  private webViewRef: { postMessage: (msg: string) => void } | null = null;

  /**
   * Set the WebView reference for communication.
   * Called when the hidden WebView component mounts.
   */
  setWebView(ref: { postMessage: (msg: string) => void }): void {
    this.webViewRef = ref;
  }

  /**
   * Call a method on the WASM BitBox API via the WebView bridge.
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.webViewRef) {
      throw new Error('WebView bridge not initialized');
    }

    const id = ++this.callId;

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      });

      this.webViewRef!.postMessage(
        JSON.stringify({ id, method, params }),
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`WASM bridge call timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Handle messages coming back from the WebView.
   * Called from the WebView's onMessage handler.
   */
  onMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'transport_write') {
        // WebView wants to write to transport — handled by BitboxProvider
        this.onTransportWrite?.(new Uint8Array(msg.data));
        return;
      }

      if (msg.type === 'transport_read') {
        // WebView wants to read from transport — handled by BitboxProvider
        this.onTransportRead?.();
        return;
      }

      // Response to a call
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }

  /**
   * Send transport data from RN to the WebView (response to transport_read).
   */
  sendTransportData(data: Uint8Array): void {
    this.webViewRef?.postMessage(
      JSON.stringify({
        type: 'transport_read_response',
        data: Array.from(data),
      }),
    );
  }

  /** Callback: WebView wants to write bytes to the physical transport */
  onTransportWrite: ((data: Uint8Array) => void) | null = null;

  /** Callback: WebView wants to read bytes from the physical transport */
  onTransportRead: (() => void) | null = null;

  /** Clean up */
  destroy(): void {
    this.pending.forEach((p) => p.reject(new Error('Bridge destroyed')));
    this.pending.clear();
    this.webViewRef = null;
    this.onTransportWrite = null;
    this.onTransportRead = null;
  }
}

/**
 * HTML content for the hidden WebView that loads bitbox-api WASM.
 *
 * This would be loaded as the WebView source. It:
 * 1. Initializes the WASM module
 * 2. Creates a custom transport that bridges to React Native
 * 3. Handles RPC calls from React Native
 */
export const BRIDGE_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script type="module">
  // TODO: Load bitbox-api WASM here
  // import init, { PairingBitBox, PairedBitBox } from './bitbox_api.js';
  //
  // Custom transport that bridges to React Native:
  // const transport = {
  //   write: async (data) => {
  //     window.ReactNativeWebView.postMessage(JSON.stringify({
  //       type: 'transport_write', data: Array.from(data)
  //     }));
  //   },
  //   read: async () => {
  //     window.ReactNativeWebView.postMessage(JSON.stringify({
  //       type: 'transport_read'
  //     }));
  //     return new Promise(resolve => { pendingRead = resolve; });
  //   }
  // };
  //
  // Handle calls from React Native:
  // window.addEventListener('message', async (event) => {
  //   const msg = JSON.parse(event.data);
  //   if (msg.type === 'transport_read_response') {
  //     pendingRead?.(new Uint8Array(msg.data));
  //     return;
  //   }
  //   try {
  //     const result = await pairedBitBox[msg.method](...msg.params);
  //     window.ReactNativeWebView.postMessage(JSON.stringify({ id: msg.id, result }));
  //   } catch (err) {
  //     window.ReactNativeWebView.postMessage(JSON.stringify({ id: msg.id, error: err.message }));
  //   }
  // });
</script>
</body>
</html>
`;
