/**
 * Tests for the WebView bridge HTML payload. We can't actually run the HTML
 * inside a WebView from jsdom, but we CAN assert structural invariants:
 *
 *   - The nonce placeholder gets replaced by renderBridgeHtml.
 *   - The rendered HTML contains a Content-Security-Policy that locks down
 *     anything unexpected (CRIT-1 reduction surface).
 *   - The session nonce comparison logic is present.
 *   - Every JSON-RPC handler we plan to expose is listed.
 *   - No remote URLs are loaded — the WASM is referenced as a relative asset.
 */

import { BRIDGE_HTML, renderBridgeHtml } from '@/features/hardware-wallet/services/bridge-html';

describe('bridge-html', () => {
  it('renderBridgeHtml substitutes the nonce placeholder', () => {
    const nonce = 'a'.repeat(32);
    const html = renderBridgeHtml(nonce);
    expect(html).toContain(`const SESSION_NONCE = '${nonce}'`);
    expect(html).not.toContain('__BRIDGE_NONCE__');
  });

  it('renderBridgeHtml refuses short nonces', () => {
    expect(() => renderBridgeHtml('short')).toThrow(/at least 16/);
    expect(() => renderBridgeHtml('')).toThrow(/at least 16/);
  });

  it('embeds a strict Content-Security-Policy', () => {
    expect(BRIDGE_HTML).toContain('Content-Security-Policy');
    expect(BRIDGE_HTML).toContain("default-src 'none'");
    expect(BRIDGE_HTML).toContain("img-src 'none'");
    expect(BRIDGE_HTML).toContain("object-src 'none'");
    expect(BRIDGE_HTML).toContain("base-uri 'none'");
    expect(BRIDGE_HTML).toContain("form-action 'none'");
  });

  it('compares inbound message nonces against the session nonce', () => {
    expect(BRIDGE_HTML).toContain('msg.nonce !== SESSION_NONCE');
  });

  it('exposes the JSON-RPC methods the BitboxProvider relies on', () => {
    for (const method of [
      'pair',
      'close',
      'deviceInfo',
      'ethAddress',
      'ethSignMessage',
      'ethSign1559Transaction',
      'ethSignTransaction',
      'btcAddress',
    ]) {
      expect(BRIDGE_HTML).toContain(method);
    }
  });

  it('loads the WASM from a relative asset path (no remote URLs)', () => {
    // No fully-qualified http(s) URL should appear in the script; an
    // attacker substituting a remote bitbox-api would otherwise be free
    // to ship key-extraction code.
    expect(BRIDGE_HTML).not.toMatch(/https?:\/\/[^"\s']+\.(?:js|wasm)/);
    expect(BRIDGE_HTML).toContain('./bitbox_api.js');
    expect(BRIDGE_HTML).toContain('./bitbox_api_bg.wasm');
  });

  it('signals wasm_ready only after the module successfully loads', () => {
    expect(BRIDGE_HTML).toMatch(/import\(['"]\.\/bitbox_api\.js['"]\)/);
    expect(BRIDGE_HTML).toMatch(/postRaw\(\{ type: 'wasm_ready' \}\)/);
  });

  it('reports a structured error if the wasm load fails', () => {
    expect(BRIDGE_HTML).toContain("wasm load failed");
  });
});
