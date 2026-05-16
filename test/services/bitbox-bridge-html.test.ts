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
 *   - Inbound dispatch is hardened against prototype-pollution.
 *   - Result/error envelopes carry the method name so RN can verify it.
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

  it('renderBridgeHtml rejects non-hex characters in the nonce', () => {
    // The nonce is interpolated into a single-quoted JS string literal.
    // Anything outside [0-9a-f] could break out of the literal — fail
    // closed instead of trusting the source-of-nonce.
    expect(() => renderBridgeHtml("aaaaaaaaaaaaaaaa'+1+'")).toThrow(/hex/);
    expect(() => renderBridgeHtml('AAAAAAAAAAAAAAAA')).toThrow(/hex/);
    expect(() => renderBridgeHtml('a'.repeat(15) + 'Z')).toThrow(/hex/);
  });

  it('embeds a strict Content-Security-Policy', () => {
    expect(BRIDGE_HTML).toContain('Content-Security-Policy');
    expect(BRIDGE_HTML).toContain("default-src 'none'");
    expect(BRIDGE_HTML).toContain("img-src 'none'");
    expect(BRIDGE_HTML).toContain("object-src 'none'");
    expect(BRIDGE_HTML).toContain("base-uri 'none'");
    expect(BRIDGE_HTML).toContain("form-action 'none'");
  });

  // Regression for CSP hardening: 'unsafe-eval' was previously needed
  // because WASM compilation triggered it. Modern engines support the
  // narrower 'wasm-unsafe-eval' directive — keep WASM working while
  // closing the door to general eval. style-src 'unsafe-inline' was
  // unnecessary (the page has no <style> at all).
  it('CSP forbids unsafe-eval and unsafe-inline; uses wasm-unsafe-eval', () => {
    expect(BRIDGE_HTML).toMatch(/script-src 'self' 'wasm-unsafe-eval'/);
    expect(BRIDGE_HTML).not.toMatch(/'unsafe-eval'(?! ')/); // require the wasm- prefix
    expect(BRIDGE_HTML).not.toContain("'unsafe-inline'");
    expect(BRIDGE_HTML).toContain("style-src 'none'");
  });

  // Defence-in-depth additions: page is never framed, never spawns
  // workers, never plays media.
  it('CSP includes frame-ancestors / worker-src / media-src locked to none', () => {
    expect(BRIDGE_HTML).toContain("frame-ancestors 'none'");
    expect(BRIDGE_HTML).toContain("worker-src 'none'");
    expect(BRIDGE_HTML).toContain("media-src 'none'");
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
      'ethXpub',
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

  it('reports a typed wasm_error on load failure (not generic id:0 error)', () => {
    // Regression: the old code emitted `{ type: 'error', id: 0, ... }`
    // which RN's onMessage dropped because callIds start at 1. The
    // new bridge emits `wasm_error` which RN handles specifically by
    // failing all readyWaiters fast.
    expect(BRIDGE_HTML).toContain("type: 'wasm_error'");
    expect(BRIDGE_HTML).toContain('wasm load failed');
  });

  // Regression for CC-17: result and error envelopes echo `method`
  // so the RN bridge can verify the response matches the pending call.
  // A forged result with the predicted next id cannot satisfy a
  // different in-flight call.
  it('result and error envelopes include the method name', () => {
    expect(BRIDGE_HTML).toMatch(/postRaw\(\{ type: 'result', id: msg\.id, method, result \}\)/);
    expect(BRIDGE_HTML).toMatch(
      /postRaw\(\{ type: 'error', id: msg\.id, method, error: \{ code, message \} \}\)/,
    );
  });

  // Regression for HIGH-5: dispatch table uses Object.create(null) so
  // __proto__ / constructor / toString cannot resolve to inherited
  // properties.
  it('DISPATCH table is a null-prototype object with hasOwn guard', () => {
    expect(BRIDGE_HTML).toContain('const DISPATCH = Object.create(null)');
    expect(BRIDGE_HTML).toContain('Object.prototype.hasOwnProperty.call(DISPATCH');
  });

  // Regression for the prototype-pollution surface on inbound JSON.
  it('JSON.parse uses a reviver that drops __proto__ / constructor / prototype', () => {
    expect(BRIDGE_HTML).toMatch(/JSON\.parse\(event\.data,/);
    expect(BRIDGE_HTML).toContain("'__proto__'");
    expect(BRIDGE_HTML).toContain("'constructor'");
    expect(BRIDGE_HTML).toContain("'prototype'");
  });

  // Regression: transport_error message terminates a pending WASM read
  // immediately so the bridge call rejects fast instead of waiting for
  // the 120s sign-timeout.
  it('handles transport_error by rejecting the in-flight read', () => {
    expect(BRIDGE_HTML).toContain("msg.type === 'transport_error'");
    expect(BRIDGE_HTML).toContain('pendingReadReject');
  });

  // Regression: msg.id must be a positive integer to be processed.
  it('rejects non-integer or non-positive ids in call messages', () => {
    expect(BRIDGE_HTML).toMatch(
      /typeof msg\.id !== 'number' \|\| !Number\.isInteger\(msg\.id\) \|\| msg\.id <= 0/,
    );
  });
});
