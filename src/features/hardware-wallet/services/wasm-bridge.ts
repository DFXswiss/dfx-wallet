/**
 * WebView WASM Bridge for bitbox-api.
 *
 * Runs the Rust/WASM bitbox-api inside a hidden WebView. React Native talks
 * to it via a strict message protocol with a per-session nonce, a typed
 * request/response envelope, and a "wasm_ready" handshake the RN side waits
 * on before issuing any calls.
 *
 * Architecture:
 *   ┌─────────────────────┐         ┌──────────────────────────┐
 *   │  React Native       │ ◄─────► │  Hidden WebView          │
 *   │  (BitboxProvider)   │  JSON   │  (bitbox-api WASM)       │
 *   │                     │         │                          │
 *   │  USB/BLE Transport ─┼─────────┼→ Custom ReadWrite impl   │
 *   └─────────────────────┘         └──────────────────────────┘
 *
 * Wire protocol — every message carries the session nonce; messages without
 * a matching nonce are dropped. This prevents a stale WebView (after
 * navigation), a duplicated WebView, or a hostile page-injection from
 * interleaving with the live session.
 *
 *   RN → WebView:  { nonce, type: 'call',                  id, method, params }
 *   WebView → RN:  { nonce, type: 'result',                id, result }
 *   WebView → RN:  { nonce, type: 'error',                 id, error: { code?, message } }
 *   WebView → RN:  { nonce, type: 'transport_write',       data: number[] }
 *   WebView → RN:  { nonce, type: 'transport_read' }
 *   RN → WebView:  { nonce, type: 'transport_read_response', data: number[] }
 *   WebView → RN:  { nonce, type: 'wasm_ready' }
 *
 * The bridge HTML is checked into bridge-html.ts as a separate module so
 * it can be inspected, security-reviewed, and (in a future iteration)
 * loaded from a packaged asset with a proper CSP.
 */

import { BRIDGE_HTML } from './bridge-html';
import { HwBridgeNotReadyError, HwBridgeTimeoutError } from './errors';

export { BRIDGE_HTML };

type PendingCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
};

type OutboundMessage =
  | { nonce: string; type: 'call'; id: number; method: string; params: unknown[] }
  | { nonce: string; type: 'transport_read_response'; data: number[] };

type InboundMessage =
  | { nonce: string; type: 'wasm_ready' }
  | { nonce: string; type: 'result'; id: number; result: unknown }
  | { nonce: string; type: 'error'; id: number; error: { code?: number; message: string } }
  | { nonce: string; type: 'transport_write'; data: number[] }
  | { nonce: string; type: 'transport_read' };

const DEFAULT_TIMEOUT_MS = 30_000;

export interface WebViewRef {
  postMessage(msg: string): void;
}

export class WasmBridge {
  private callId = 0;
  private pending = new Map<number, PendingCall>();
  private webViewRef: WebViewRef | null = null;
  /**
   * Session nonce — generated in the constructor so renderBridgeHtml never
   * sees an empty nonce. setWebView rotates it on each session rebind so
   * stale traffic from a previous WebView can never satisfy a pending call.
   */
  private nonce: string = generateNonce();
  private wasmReady = false;
  private readyWaiters: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  /** Read-side transport callbacks: BitboxProvider wires these. */
  onTransportWrite: ((data: Uint8Array) => void) | null = null;
  onTransportRead: (() => void) | null = null;

  /**
   * Set the WebView reference and reset the session. Generates a fresh
   * nonce so any in-flight pending calls bound to the previous session
   * cannot be satisfied by stale traffic.
   */
  setWebView(ref: WebViewRef): void {
    this.destroyInternal(new HwBridgeNotReadyError('session re-bound to a new WebView'));
    this.webViewRef = ref;
    this.nonce = generateNonce();
    // Reset call ID so id-based replays from the previous session cannot
    // satisfy calls of the new session even if the nonce check were ever
    // weakened.
    this.callId = 0;
    this.wasmReady = false;
  }

  /** Returns the current session nonce — exposed for the HTML bootstrap to inject. */
  getSessionNonce(): string {
    return this.nonce;
  }

  /**
   * Block until the WebView posts a `wasm_ready` message for the current
   * session, or `timeoutMs` elapses (default 5s). Subsequent calls return
   * immediately once ready.
   */
  waitReady(timeoutMs = 5_000): Promise<void> {
    if (this.wasmReady) return Promise.resolve();
    if (!this.webViewRef) {
      return Promise.reject(new HwBridgeNotReadyError('no WebView attached'));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.readyWaiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.readyWaiters.splice(idx, 1);
        reject(new HwBridgeNotReadyError(`wasm did not signal ready within ${timeoutMs}ms`));
      }, timeoutMs);
      this.readyWaiters.push({ resolve, reject, timer });
    });
  }

  /**
   * Call a method on the WASM BitBox API via the WebView bridge.
   * `opts.timeoutMs` overrides the default per call — signing calls should
   * pass at least 120000.
   */
  async call<T>(
    method: string,
    params: unknown[] = [],
    opts: { timeoutMs?: number } = {},
  ): Promise<T> {
    if (!this.webViewRef) {
      throw new HwBridgeNotReadyError('no WebView attached');
    }
    if (!this.wasmReady) {
      throw new HwBridgeNotReadyError(
        `wasm not ready yet; await waitReady() before calling ${method}`,
      );
    }

    const id = ++this.callId;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const method_ = method;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new HwBridgeTimeoutError(method_, timeoutMs));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
        method: method_,
      });

      const out: OutboundMessage = {
        nonce: this.nonce,
        type: 'call',
        id,
        method: method_,
        params,
      };
      this.webViewRef!.postMessage(JSON.stringify(out));
    });
  }

  /**
   * Handle messages coming back from the WebView. Drops messages whose
   * nonce does not match the active session. Malformed JSON is silently
   * ignored (the source page may be loading or shutting down).
   */
  onMessage(data: string): void {
    let parsed: InboundMessage;
    try {
      parsed = JSON.parse(data) as InboundMessage;
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.nonce !== this.nonce) {
      // Drop — wrong session or malformed envelope.
      return;
    }

    switch (parsed.type) {
      case 'wasm_ready':
        this.wasmReady = true;
        while (this.readyWaiters.length > 0) {
          const w = this.readyWaiters.shift()!;
          clearTimeout(w.timer);
          w.resolve();
        }
        return;

      case 'transport_write':
        this.onTransportWrite?.(new Uint8Array(parsed.data ?? []));
        return;

      case 'transport_read':
        this.onTransportRead?.();
        return;

      case 'result': {
        const pending = this.pending.get(parsed.id);
        if (!pending) return;
        this.pending.delete(parsed.id);
        clearTimeout(pending.timer);
        pending.resolve(parsed.result);
        return;
      }

      case 'error': {
        const pending = this.pending.get(parsed.id);
        if (!pending) return;
        this.pending.delete(parsed.id);
        clearTimeout(pending.timer);
        const err = new Error(parsed.error?.message ?? 'unknown bridge error');
        // Preserve the firmware code (if present) so parseFirmwareError can recover it.
        if (parsed.error?.code !== undefined) {
          (err as Error & { code?: number }).code = parsed.error.code;
        }
        pending.reject(err);
        return;
      }
    }
  }

  /** Send transport bytes from RN to the WebView (response to transport_read). */
  sendTransportData(data: Uint8Array): void {
    if (!this.webViewRef) return;
    const out: OutboundMessage = {
      nonce: this.nonce,
      type: 'transport_read_response',
      data: Array.from(data),
    };
    this.webViewRef.postMessage(JSON.stringify(out));
  }

  /**
   * Reject every pending call, clear the WebView ref, void the nonce.
   * Safe to call multiple times.
   */
  destroy(): void {
    this.destroyInternal(new HwBridgeNotReadyError('bridge destroyed'));
  }

  private destroyInternal(reason: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pending.clear();
    for (const w of this.readyWaiters) {
      clearTimeout(w.timer);
      w.reject(reason);
    }
    this.readyWaiters = [];
    this.webViewRef = null;
    this.nonce = '';
    this.wasmReady = false;
    this.onTransportWrite = null;
    this.onTransportRead = null;
  }
}

/** Crypto-grade nonce (16 bytes hex) for session binding. */
function generateNonce(): string {
  // crypto.getRandomValues is available on RN's Hermes runtime via the
  // expo-crypto polyfill; we fall back to Math.random for tests where no
  // crypto global exists.
  const buf = new Uint8Array(16);
  const g = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => void } }).crypto;
  if (g?.getRandomValues) {
    g.getRandomValues(buf);
  } else {
    // eslint-disable-next-line security/detect-object-injection -- i is bounded by buf.length above
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
