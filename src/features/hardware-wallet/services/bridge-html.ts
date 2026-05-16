// audit-skip-file: this file is the SDK shim — ethSign* references here
// delegate to bitbox-api WASM which enforces antiklepto internally.

/**
 * HTML payload for the hidden WebView that hosts the bitbox-api WASM.
 *
 * The WebView is loaded with this string as its source (or as a packaged
 * asset under `assets/bitbox-bridge/index.html` for proper CSP). On load
 * the page:
 *
 *   1. Imports the bitbox-api WASM module.
 *   2. Establishes a custom transport that proxies read/write calls back
 *      to React Native via window.ReactNativeWebView.postMessage.
 *   3. Pairs with the BitBox via PairingBitBox.waitConfirm() / pair().
 *   4. Re-exports every PairedBitBox method behind a stable JSON-RPC
 *      surface keyed by the session nonce that React Native injected.
 *
 * The page also enforces:
 *
 *   - Session nonce: every inbound message must carry the nonce that RN
 *     posted into a global at load time. Out-of-band messages (XSS, stale
 *     window references) are rejected.
 *   - Single PairedBitBox instance per session: methods that arrive
 *     before pairing completes queue; methods that arrive after the
 *     instance has been free()'d throw.
 *
 * --
 * SECURITY NOTE — the WASM blob is fetched from a packaged asset (NOT a
 * remote URL). The asset's SHA256 is pinned at build time via
 * scripts/verify-bitbox-wasm.sh; a tampered binary fails the verification
 * step before React Native can load the WebView.
 */

const BRIDGE_NONCE_PLACEHOLDER = '__BRIDGE_NONCE__';

export const BRIDGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; img-src 'none'; style-src 'none'; media-src 'none'; worker-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none';">
<title>bitbox-bridge</title>
</head>
<body>
<script type="module">
'use strict';

// Session nonce is injected by the host before this HTML is rendered.
// It is compared against every inbound message so stale or hostile
// windows cannot interleave with the live session.
const SESSION_NONCE = '${BRIDGE_NONCE_PLACEHOLDER}';

if (!SESSION_NONCE || SESSION_NONCE.length < 16 || SESSION_NONCE.includes('__')) {
  postRaw({ type: 'wasm_error', id: 0, error: { message: 'bridge boot failed: missing session nonce' } });
  throw new Error('bridge boot failed: missing session nonce');
}

function postRaw(payload) {
  const msg = JSON.stringify({ nonce: SESSION_NONCE, ...payload });
  if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
    window.ReactNativeWebView.postMessage(msg);
  }
}

let bitbox = null;        // imported WASM module
let pairing = null;       // PairingBitBox instance, waiting for waitConfirm
let paired  = null;       // PairedBitBox instance after waitConfirm
let pendingReadResolve = null;
let pendingReadReject = null;

// Custom transport bridging WebView ↔ React Native.
// The WASM library calls write(bytes); we forward to RN, which routes to
// the physical USB / BLE transport. read() returns a Promise that
// resolves with the next chunk RN delivers via transport_read_response,
// OR rejects when RN posts transport_error (transport dropped mid-flow).
const transport = {
  write: async (data) => {
    postRaw({ type: 'transport_write', data: Array.from(data) });
  },
  read: async () => {
    return new Promise((resolve, reject) => {
      pendingReadResolve = resolve;
      pendingReadReject = reject;
      postRaw({ type: 'transport_read' });
    });
  },
  close: async () => {
    if (pendingReadReject) {
      const reject = pendingReadReject;
      pendingReadResolve = null;
      pendingReadReject = null;
      reject(new Error('transport closed'));
    }
  },
};

// Method dispatch table. Object.create(null) so __proto__ / constructor
// / toString lookups don't resolve to Object.prototype getters.
const DISPATCH = Object.create(null);
DISPATCH.pair = async () => {
  if (!bitbox) throw new Error('wasm not loaded');
  pairing = await bitbox.bitbox02ConnectAuto(transport);
  paired = await pairing.unlockAndPair();
  return { channelHash: paired.channelHash ? Array.from(paired.channelHash()) : null };
};
DISPATCH.close = async () => {
  if (paired && paired.free) paired.free();
  if (pairing && pairing.free) pairing.free();
  paired = null;
  pairing = null;
  return null;
};
DISPATCH.deviceInfo = async () => {
  if (!paired) throw new Error('not paired');
  return paired.deviceInfo();
};
DISPATCH.ethAddress = async ([chainId, derivationPath, display]) => {
  if (!paired) throw new Error('not paired');
  return paired.ethAddress(BigInt(chainId), derivationPath, display === true);
};
DISPATCH.ethXpub = async ([derivationPath]) => {
  if (!paired) throw new Error('not paired');
  return paired.ethXpub(derivationPath);
};
DISPATCH.ethSignMessage = async ([chainId, derivationPath, message]) => {
  if (!paired) throw new Error('not paired');
  const sig = await paired.ethSignMessage(BigInt(chainId), derivationPath, new Uint8Array(message));
  return { r: Array.from(sig.r), s: Array.from(sig.s), v: Array.from(sig.v) };
};
DISPATCH.ethSign1559Transaction = async ([chainId, derivationPath, tx]) => {
  if (!paired) throw new Error('not paired');
  const sig = await paired.ethSign1559Transaction(BigInt(chainId), derivationPath, new Uint8Array(tx));
  return { r: Array.from(sig.r), s: Array.from(sig.s), v: Array.from(sig.v) };
};
DISPATCH.ethSignTransaction = async ([chainId, derivationPath, tx]) => {
  if (!paired) throw new Error('not paired');
  const sig = await paired.ethSignTransaction(BigInt(chainId), derivationPath, new Uint8Array(tx));
  return { r: Array.from(sig.r), s: Array.from(sig.s), v: Array.from(sig.v) };
};
DISPATCH.btcAddress = async ([coin, derivationPath, scriptConfig, display]) => {
  if (!paired) throw new Error('not paired');
  return paired.btcAddress(coin, derivationPath, scriptConfig, display === true);
};

// Defence in depth: hasOwn-style guard so an attacker who could somehow
// inject a call with method === '__proto__' or 'toString' cannot reach
// Object.prototype getters. Object.create(null) above already removes
// the lookups, but the explicit check is cheap and self-documenting.
function getHandler(method) {
  if (typeof method !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(DISPATCH, method)) return null;
  return DISPATCH[method];
}

window.addEventListener('message', async (event) => {
  let msg;
  // Reject __proto__ / constructor at parse time via reviver — defence
  // in depth; the WASM JS engine already rejects __proto__ in JSON.parse,
  // but a future runtime change shouldn't be load-bearing.
  try {
    msg = JSON.parse(event.data, (k, v) =>
      k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v,
    );
  } catch {
    return;
  }
  if (!msg || msg.nonce !== SESSION_NONCE) return;

  if (msg.type === 'transport_read_response') {
    const resolve = pendingReadResolve;
    pendingReadResolve = null;
    pendingReadReject = null;
    resolve && resolve(new Uint8Array(msg.data ?? []));
    return;
  }
  if (msg.type === 'transport_error') {
    const reject = pendingReadReject;
    pendingReadResolve = null;
    pendingReadReject = null;
    if (reject) reject(new Error('transport error: ' + (msg.error?.message ?? 'unknown')));
    return;
  }

  if (msg.type !== 'call') return;
  if (typeof msg.id !== 'number' || !Number.isInteger(msg.id) || msg.id <= 0) return;

  const method = msg.method;
  const handler = getHandler(method);
  if (!handler) {
    postRaw({ type: 'error', id: msg.id, method, error: { message: 'unknown method: ' + method } });
    return;
  }

  try {
    const result = await handler(msg.params ?? []);
    // Echo the method in the result envelope. The RN side verifies it
    // matches the pending entry, so a forged result for the next id
    // cannot satisfy a different in-flight call.
    postRaw({ type: 'result', id: msg.id, method, result });
  } catch (err) {
    const message = (err && err.message) ? err.message : String(err);
    const code = (err && typeof err.code === 'number') ? err.code : undefined;
    postRaw({ type: 'error', id: msg.id, method, error: { code, message } });
  }
});

// Load bitbox-api. The asset path is resolved relative to baseUrl in
// the WebView's source prop — see HardwareConnectScreenImpl for wiring.
import('./bitbox_api.js').then(async (mod) => {
  await mod.default('./bitbox_api_bg.wasm');
  bitbox = mod;
  postRaw({ type: 'wasm_ready' });
}).catch((err) => {
  // Use a dedicated type so the RN side can fail all readyWaiters fast
  // (the previous { type: 'error', id: 0 } was dropped because callIds
  // start at 1).
  postRaw({ type: 'wasm_error', id: 0, error: { message: 'wasm load failed: ' + (err && err.message ? err.message : err) } });
});
</script>
</body>
</html>
`;

/**
 * Render the bridge HTML with the live session nonce baked in. The bridge
 * page compares every inbound message's nonce against this value; an
 * empty / placeholder nonce will short-circuit the page before any WASM
 * is loaded.
 */
export function renderBridgeHtml(sessionNonce: string): string {
  if (!sessionNonce || sessionNonce.length < 16) {
    throw new Error('renderBridgeHtml: sessionNonce must be at least 16 hex chars');
  }
  // Hard-restrict the alphabet so the nonce cannot break out of the JS
  // string literal it gets baked into. generateNonce() produces lowercase
  // hex; anything else is a bug or a tampering attempt.
  if (!/^[0-9a-f]+$/.test(sessionNonce)) {
    throw new Error('renderBridgeHtml: sessionNonce must be lowercase hex');
  }
  return BRIDGE_HTML.replace(BRIDGE_NONCE_PLACEHOLDER, sessionNonce);
}
