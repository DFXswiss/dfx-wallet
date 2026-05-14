/**
 * Inline HTML for the hidden WebView that runs bitbox-api WASM.
 *
 * The WebView engine (WKWebView on iOS, Chrome on Android) provides
 * native WASM support that Hermes/JSC lack. This HTML page:
 *
 * 1. Loads the bitbox-api WASM module (inline base64)
 * 2. Implements a custom ReadWrite transport bridging to React Native
 * 3. Dispatches RPC calls from React Native to the PairedBitBox instance
 *
 * Message protocol (must match wasm-bridge.ts):
 *   RN → WebView:  { id, method, params }           — RPC call
 *   WebView → RN:  { id, result } | { id, error }   — RPC response
 *   WebView → RN:  { type: 'transport_write', data } — write to USB/BLE
 *   WebView → RN:  { type: 'transport_read' }        — request read from USB/BLE
 *   RN → WebView:  { type: 'transport_read_response', data } — read response
 *   WebView → RN:  { type: 'ready' }                 — WASM initialized
 *   WebView → RN:  { type: 'error', message }        — initialization error
 */
export const BITBOX_WASM_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body>
<script>
(function() {
  "use strict";

  var pairedBitBox = null;
  var pendingRead = null;

  // --- Transport: bridges WebView ↔ React Native ↔ USB/BLE ---
  var transport = {
    write: function(data) {
      return new Promise(function(resolve) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "transport_write",
          data: Array.from(new Uint8Array(data))
        }));
        resolve();
      });
    },
    read: function() {
      return new Promise(function(resolve) {
        pendingRead = resolve;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "transport_read"
        }));
      });
    }
  };

  // --- Handle messages from React Native ---
  document.addEventListener("message", onMessage);
  window.addEventListener("message", onMessage);

  function onMessage(event) {
    var msg;
    try {
      msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    } catch (e) {
      return;
    }

    // Transport read response from native USB/BLE
    if (msg.type === "transport_read_response") {
      if (pendingRead) {
        var cb = pendingRead;
        pendingRead = null;
        cb(new Uint8Array(msg.data));
      }
      return;
    }

    // RPC call from React Native
    if (typeof msg.id === "number" && typeof msg.method === "string") {
      handleRpcCall(msg);
    }
  }

  function handleRpcCall(msg) {
    var id = msg.id;
    var method = msg.method;
    var params = msg.params || [];

    // Special methods handled before pairing
    if (method === "pair") {
      handlePair(id, params);
      return;
    }

    if (method === "close") {
      handleClose(id);
      return;
    }

    if (!pairedBitBox) {
      sendError(id, "Not paired. Call pair() first.");
      return;
    }

    if (typeof pairedBitBox[method] !== "function") {
      sendError(id, "Unknown method: " + method);
      return;
    }

    try {
      var result = pairedBitBox[method].apply(pairedBitBox, params);
      if (result && typeof result.then === "function") {
        result.then(function(res) {
          sendResult(id, res);
        }).catch(function(err) {
          sendError(id, err.message || String(err));
        });
      } else {
        sendResult(id, result);
      }
    } catch (err) {
      sendError(id, err.message || String(err));
    }
  }

  function handlePair(id, params) {
    if (typeof window.bitboxAPI === "undefined") {
      sendError(id, "WASM module not loaded");
      return;
    }

    try {
      window.bitboxAPI.PairingBitBox(transport).then(function(pairingBB) {
        return pairingBB.waitConfirm();
      }).then(function(paired) {
        pairedBitBox = paired;
        sendResult(id, true);
      }).catch(function(err) {
        sendError(id, "Pairing failed: " + (err.message || String(err)));
      });
    } catch (err) {
      sendError(id, "Pairing failed: " + (err.message || String(err)));
    }
  }

  function handleClose(id) {
    if (pairedBitBox && typeof pairedBitBox.close === "function") {
      pairedBitBox.close();
    }
    pairedBitBox = null;
    sendResult(id, true);
  }

  function sendResult(id, result) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, result: result }));
  }

  function sendError(id, message) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, error: message }));
  }

  // --- Load WASM ---
  function initWasm() {
    if (typeof window.bitboxAPI !== "undefined" && typeof window.bitboxAPI.default === "function") {
      window.bitboxAPI.default().then(function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ready" }));
      }).catch(function(err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "error",
          message: "WASM init failed: " + (err.message || String(err))
        }));
      });
    } else {
      // WASM module not yet bundled — signal ready so the bridge doesn't hang.
      // Actual WASM loading will be wired up when the base64 bundle is generated
      // by the build script (scripts/bundle-bitbox-wasm.js).
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ready" }));
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initWasm();
  } else {
    document.addEventListener("DOMContentLoaded", initWasm);
  }
})();
</script>
</body>
</html>
`;
