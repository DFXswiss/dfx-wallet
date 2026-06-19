/**
 * Behavioral fake for the BitBox02 WASM boundary.
 *
 * Sits exactly where the real WebView (bitbox-api WASM) sits: it implements
 * the `{ postMessage }` interface that `WasmBridge.setWebView` expects and
 * answers over `bridge.onMessage`, so the entire production stack —
 * BitboxProvider → WasmBridge → message protocol — runs unmodified.
 *
 * Five outcome modes, each mirroring a real ceremony outcome:
 *
 * - `success`    — happy path: pairing, addresses and signatures resolve with
 *                  deterministic fixtures (below).
 * - `cancel`     — the user pressed X on the device during a signing ceremony.
 *                  Pairing succeeds, signing calls reject with a user-abort
 *                  error, exactly like bitbox-api surfaces it.
 * - `disconnect` — the cable was pulled / BLE dropped mid-ceremony. Pairing
 *                  succeeds, the next call rejects with a transport error.
 * - `timeout`    — the device stopped answering (e.g. stuck firmware screen).
 *                  No response is ever delivered; the WasmBridge's own 30s
 *                  timeout must fire. Drive jest fake timers to test this.
 * - `malformed`  — the WebView delivered corrupted frames (broken JSON, then
 *                  a response for an id that was never issued). The bridge
 *                  must ignore both and eventually time out.
 *
 * All fixtures are deterministic so cross-layer specs can assert one known
 * result end-to-end.
 */
import type { WasmBridge } from '@/features/hardware-wallet/services/wasm-bridge';

export type FakeBitboxMode = 'success' | 'cancel' | 'disconnect' | 'timeout' | 'malformed';

/** Deterministic fixtures — single source of truth for all assertions. */
export const FAKE_BITBOX = {
  ethAddress: '0x52908400098527886E0F7030069857D2E4169EE7',
  btcAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  // 32-byte r/s, recovery id 0x1b (27) — shape matches bitbox-api's
  // EthSignature (r, s, v as byte arrays serialized to number[] over JSON).
  sig: {
    r: Array.from({ length: 32 }, (_, i) => i + 1),
    s: Array.from({ length: 32 }, (_, i) => 64 - i),
    v: [0x1b],
  },
  errors: {
    cancel: 'sign: aborted by user on device',
    disconnect: 'transport: connection closed',
  },
} as const;

type OutboundCall = { id: number; method: string; params: unknown[] };

export class FakeBitboxWebView {
  /** Every RPC the production code sent, in order — assert params on these. */
  readonly calls: OutboundCall[] = [];

  private bridge: WasmBridge | null = null;
  private paired = false;

  constructor(public mode: FakeBitboxMode = 'success') {}

  /** Wire the fake to the bridge it should answer on. */
  bindBridge(bridge: WasmBridge): void {
    this.bridge = bridge;
    bridge.setWebView(this);
  }

  /** `{ postMessage }` — the only surface WasmBridge needs from a WebView. */
  postMessage(raw: string): void {
    const msg = JSON.parse(raw) as { id?: number; method?: string; params?: unknown[] };
    if (typeof msg.id !== 'number' || typeof msg.method !== 'string') {
      // transport_read_response etc. — not an RPC, nothing to answer.
      return;
    }
    this.calls.push({ id: msg.id, method: msg.method, params: msg.params ?? [] });
    this.respond(msg.id, msg.method);
  }

  private respond(id: number, method: string): void {
    const reply = (payload: object) => this.bridge?.onMessage(JSON.stringify(payload));

    switch (this.mode) {
      case 'timeout':
        // Device never answers — the bridge's own timeout owns this path.
        return;

      case 'malformed':
        // Corrupted frame, then a frame for an id that was never issued.
        this.bridge?.onMessage('{not json');
        reply({ id: id + 9999, result: 'stray' });
        return;

      case 'disconnect':
        if (method === 'pair') {
          this.paired = true;
          reply({ id, result: null });
          return;
        }
        reply({ id, error: FAKE_BITBOX.errors.disconnect });
        return;

      case 'cancel':
        if (method === 'pair' || method === 'close') {
          this.paired = method === 'pair';
          reply({ id, result: null });
          return;
        }
        reply({ id, error: FAKE_BITBOX.errors.cancel });
        return;

      case 'success':
        switch (method) {
          case 'pair':
            this.paired = true;
            reply({ id, result: null });
            return;
          case 'close':
            this.paired = false;
            reply({ id, result: null });
            return;
          case 'ethAddress':
            reply({ id, result: FAKE_BITBOX.ethAddress });
            return;
          case 'btcAddress':
            reply({ id, result: FAKE_BITBOX.btcAddress });
            return;
          case 'ethSign1559Transaction':
          case 'ethSignMessage':
          case 'ethSignTypedMessage':
            reply({ id, result: FAKE_BITBOX.sig });
            return;
          default:
            reply({ id, error: `fake-bitbox: unhandled method '${method}'` });
            return;
        }
    }
  }

  get isPaired(): boolean {
    return this.paired;
  }
}

/**
 * Minimal in-memory BitboxTransport. Records writes; `read()` blocks until
 * `pushRead` delivers bytes (mirrors the byte-level USB/BLE contract).
 */
export class FakeTransport {
  readonly writes: Uint8Array[] = [];
  closed = false;
  private readQueue: Uint8Array[] = [];
  private pendingRead: ((data: Uint8Array) => void) | null = null;

  async write(data: Uint8Array): Promise<number> {
    this.writes.push(data);
    return data.length;
  }

  async read(): Promise<Uint8Array> {
    const queued = this.readQueue.shift();
    if (queued) return queued;
    return new Promise<Uint8Array>((resolve) => {
      this.pendingRead = resolve;
    });
  }

  pushRead(data: Uint8Array): void {
    if (this.pendingRead) {
      this.pendingRead(data);
      this.pendingRead = null;
    } else {
      this.readQueue.push(data);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
