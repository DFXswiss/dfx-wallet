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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'self'; img-src 'none'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none';">
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
  postRaw({ type: 'error', id: 0, error: { message: 'bridge boot failed: missing session nonce' } });
  throw new Error('bridge boot failed: missing session nonce');
}

function postRaw(payload) {
  const msg = JSON.stringify({ nonce: SESSION_NONCE, ...payload });
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(msg);
}

let bitbox = null;        // imported WASM module
let pairing = null;       // PairingBitBox instance, waiting for waitConfirm
let paired  = null;       // PairedBitBox instance after waitConfirm
let pendingReadResolve = null;

// Custom transport bridging WebView ↔ React Native.
// The WASM library calls write(bytes); we forward to RN, which routes to
// the physical USB / BLE transport. read() returns a Promise that
// resolves with the next chunk RN delivers via transport_read_response.
const transport = {
  write: async (data) => {
    postRaw({ type: 'transport_write', data: Array.from(data) });
  },
  read: async () => {
    return new Promise((resolve) => {
      pendingReadResolve = resolve;
      postRaw({ type: 'transport_read' });
    });
  },
  close: async () => {
    pendingReadResolve = null;
  },
};

// Method dispatch table. Each entry takes (params) and resolves to the
// JSON-serialisable result the host expects.
const DISPATCH = {
  pair: async () => {
    if (!bitbox) throw new Error('wasm not loaded');
    pairing = await bitbox.bitbox02ConnectAuto(transport);
    paired = await pairing.unlockAndPair();
    return { channelHash: paired.channelHash ? Array.from(paired.channelHash()) : null };
  },
  close: async () => {
    if (paired && paired.free) paired.free();
    if (pairing && pairing.free) pairing.free();
    paired = null;
    pairing = null;
    return null;
  },
  deviceInfo: async () => {
    if (!paired) throw new Error('not paired');
    return paired.deviceInfo();
  },
  ethAddress: async ([chainId, derivationPath, display]) => {
    if (!paired) throw new Error('not paired');
    const keypath = derivationPath; // bitbox-api accepts string keypaths
    return paired.ethAddress(BigInt(chainId), keypath, display === true);
  },
  ethSignMessage: async ([chainId, derivationPath, message]) => {
    if (!paired) throw new Error('not paired');
    const sig = await paired.ethSignMessage(BigInt(chainId), derivationPath, new Uint8Array(message));
    return { r: Array.from(sig.r), s: Array.from(sig.s), v: [sig.v] };
  },
  ethSign1559Transaction: async ([chainId, derivationPath, tx]) => {
    if (!paired) throw new Error('not paired');
    const sig = await paired.ethSign1559Transaction(BigInt(chainId), derivationPath, new Uint8Array(tx));
    return { r: Array.from(sig.r), s: Array.from(sig.s), v: [sig.v] };
  },
  ethSignTransaction: async ([chainId, derivationPath, tx]) => {
    if (!paired) throw new Error('not paired');
    const sig = await paired.ethSignTransaction(BigInt(chainId), derivationPath, new Uint8Array(tx));
    return { r: Array.from(sig.r), s: Array.from(sig.s), v: [sig.v] };
  },
  btcAddress: async ([coin, derivationPath, scriptConfig, display]) => {
    if (!paired) throw new Error('not paired');
    return paired.btcAddress(coin, derivationPath, scriptConfig, display === true);
  },
};

window.addEventListener('message', async (event) => {
  let msg;
  try { msg = JSON.parse(event.data); } catch { return; }
  if (!msg || msg.nonce !== SESSION_NONCE) return;

  if (msg.type === 'transport_read_response') {
    const resolve = pendingReadResolve;
    pendingReadResolve = null;
    resolve && resolve(new Uint8Array(msg.data ?? []));
    return;
  }

  if (msg.type !== 'call') return;

  const handler = DISPATCH[msg.method];
  if (!handler) {
    postRaw({ type: 'error', id: msg.id, error: { message: 'unknown method: ' + msg.method } });
    return;
  }

  try {
    const result = await handler(msg.params ?? []);
    postRaw({ type: 'result', id: msg.id, result });
  } catch (err) {
    const message = (err && err.message) ? err.message : String(err);
    const code = (err && typeof err.code === 'number') ? err.code : undefined;
    postRaw({ type: 'error', id: msg.id, error: { code, message } });
  }
});

// Load bitbox-api. The asset path is resolved relative to baseUrl in
// the WebView's source prop — see HardwareConnectScreenImpl for wiring.
import('./bitbox_api.js').then(async (mod) => {
  await mod.default('./bitbox_api_bg.wasm');
  bitbox = mod;
  postRaw({ type: 'wasm_ready' });
}).catch((err) => {
  postRaw({ type: 'error', id: 0, error: { message: 'wasm load failed: ' + (err && err.message ? err.message : err) } });
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
  return BRIDGE_HTML.replace(BRIDGE_NONCE_PLACEHOLDER, sessionNonce);
}
