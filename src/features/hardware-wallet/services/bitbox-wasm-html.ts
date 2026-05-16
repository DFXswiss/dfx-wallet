/**
 * DEPRECATED — superseded by bridge-html.ts.
 *
 * This file held the original WebView payload before the session-nonce
 * protocol landed. The new payload uses a strict Content-Security-Policy,
 * a per-session nonce, and a typed JSON-RPC envelope. Importers should
 * switch to `bridge-html` directly.
 *
 * Kept as a thin re-export so any in-flight branches don't break their
 * imports. Remove in the next major release.
 */

export { BRIDGE_HTML as BITBOX_WASM_HTML } from './bridge-html';
