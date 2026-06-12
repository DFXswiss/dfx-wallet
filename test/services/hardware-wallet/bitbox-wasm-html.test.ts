/**
 * Tests for the inline WebView HTML that hosts the bitbox-api WASM module.
 *
 * Two layers:
 *
 * 1. Structural — the exported string is a complete static document with the
 *    WASM bootstrap, both message listeners, and no template interpolation
 *    (a `${...}` hole here would be an injection vector straight into a
 *    page that holds the paired Noise channel).
 *
 * 2. Behavioral — the embedded script is extracted and executed against a
 *    fake window/document/ReactNativeWebView, so the actual RPC dispatch,
 *    transport bridging and pairing state machine run for real. The message
 *    protocol asserted here is the contract wasm-bridge.ts relies on.
 */
import { BITBOX_WASM_HTML } from '@/features/hardware-wallet/services/bitbox-wasm-html';

type Posted = Record<string, unknown>;
type Listener = (event: { data: unknown }) => void;

interface SandboxOptions {
  /** Fake `window.bitboxAPI` (the WASM module). Omit = not bundled yet. */
  bitboxAPI?: Record<string, unknown>;
  /** Simulate a document that is still loading when the script runs. */
  documentLoading?: boolean;
}

/** Boots the WebView script in a sandbox and returns the RN-side handles. */
function bootWebView(opts: SandboxOptions = {}) {
  const posted: Posted[] = [];
  const windowListeners: Listener[] = [];
  const documentListeners = new Map<string, Listener[]>();

  const fakeWindow: Record<string, unknown> = {
    ReactNativeWebView: {
      postMessage: (raw: string) => posted.push(JSON.parse(raw) as Posted),
    },
    addEventListener: (type: string, fn: Listener) => {
      if (type === 'message') windowListeners.push(fn);
    },
  };
  if (opts.bitboxAPI) fakeWindow.bitboxAPI = opts.bitboxAPI;

  const fakeDocument = {
    readyState: opts.documentLoading ? 'loading' : 'complete',
    addEventListener: (type: string, fn: Listener) => {
      const list = documentListeners.get(type) ?? [];
      list.push(fn);
      documentListeners.set(type, list);
    },
  };

  const match = /<script>([\s\S]*?)<\/script>/.exec(BITBOX_WASM_HTML);
  if (!match) throw new Error('No <script> block found in BITBOX_WASM_HTML');

  // new Function: deliberately executing the production WebView script under test.
  new Function('window', 'document', match[1]!)(fakeWindow, fakeDocument);

  return {
    posted,
    /** Send a message the way React Native's WebView delivers it. */
    send: (msg: unknown) => {
      const event = { data: typeof msg === 'string' ? msg : JSON.stringify(msg) };
      for (const fn of documentListeners.get('message') ?? []) fn(event);
    },
    /** Send only via the window listener (Android delivery path). */
    sendViaWindow: (msg: unknown) => {
      for (const fn of windowListeners) fn({ data: JSON.stringify(msg) });
    },
    fireDomContentLoaded: () => {
      for (const fn of documentListeners.get('DOMContentLoaded') ?? []) fn({ data: undefined });
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A paired-device fake with the method shapes handleRpcCall exercises. */
function makePairedFake() {
  return {
    ethAddress: jest.fn(() => Promise.resolve('0xAddr')),
    syncMethod: jest.fn((a: number, b: number) => a + b),
    failingMethod: jest.fn(() => Promise.reject(new Error('user aborted'))),
    throwingMethod: jest.fn(() => {
      throw new Error('sync boom');
    }),
    close: jest.fn(),
  };
}

/** bitboxAPI whose pairing flow resolves to the given paired fake. */
function makeBitboxApi(paired: ReturnType<typeof makePairedFake>) {
  let capturedTransport: { write: Function; read: Function } | null = null;
  const api = {
    default: jest.fn(() => Promise.resolve()),
    PairingBitBox: jest.fn((transport: { write: Function; read: Function }) => {
      capturedTransport = transport;
      return Promise.resolve({ waitConfirm: () => Promise.resolve(paired) });
    }),
  };
  return { api, getTransport: () => capturedTransport };
}

describe('BITBOX_WASM_HTML structure', () => {
  it('is a complete static HTML document', () => {
    expect(BITBOX_WASM_HTML.trim()).toMatch(/^<!DOCTYPE html>/);
    expect(BITBOX_WASM_HTML).toContain('<meta charset="utf-8">');
    expect(BITBOX_WASM_HTML).toContain('</html>');
    expect(BITBOX_WASM_HTML).toContain('<script>');
    expect(BITBOX_WASM_HTML).toContain('</script>');
  });

  it('contains no template interpolation holes (injection surface)', () => {
    // The export is a template literal; any `${` surviving into the string
    // would mean runtime data is being spliced into the page.
    expect(BITBOX_WASM_HTML).not.toContain('${');
    // No obvious dynamic-eval primitives inside the page either.
    expect(BITBOX_WASM_HTML).not.toMatch(/\beval\s*\(/);
    expect(BITBOX_WASM_HTML).not.toContain('document.write');
    expect(BITBOX_WASM_HTML).not.toContain('innerHTML');
  });

  it('declares every message type of the wasm-bridge protocol', () => {
    for (const token of [
      'transport_write',
      'transport_read',
      'transport_read_response',
      '"ready"',
      '"error"',
    ]) {
      expect(BITBOX_WASM_HTML).toContain(token);
    }
  });

  it('registers both message listeners (iOS document + Android window path)', () => {
    expect(BITBOX_WASM_HTML).toContain('document.addEventListener("message", onMessage)');
    expect(BITBOX_WASM_HTML).toContain('window.addEventListener("message", onMessage)');
  });

  it('contains the WASM bootstrap gated on the bundled bitboxAPI global', () => {
    expect(BITBOX_WASM_HTML).toContain('window.bitboxAPI');
    expect(BITBOX_WASM_HTML).toContain('window.bitboxAPI.default()');
    expect(BITBOX_WASM_HTML).toContain('DOMContentLoaded');
  });
});

describe('BITBOX_WASM_HTML behavior (script executed in sandbox)', () => {
  describe('initialization', () => {
    it('signals ready immediately when no WASM bundle is present', () => {
      const { posted } = bootWebView();
      expect(posted).toEqual([{ type: 'ready' }]);
    });

    it('initializes the WASM module and then signals ready', async () => {
      const { api } = makeBitboxApi(makePairedFake());
      const { posted } = bootWebView({ bitboxAPI: api });

      await flush();
      expect(api.default).toHaveBeenCalledTimes(1);
      expect(posted).toEqual([{ type: 'ready' }]);
    });

    it('reports a typed error frame when WASM init fails', async () => {
      const api = { default: jest.fn(() => Promise.reject(new Error('bad wasm'))) };
      const { posted } = bootWebView({ bitboxAPI: api });

      await flush();
      expect(posted).toEqual([{ type: 'error', message: 'WASM init failed: bad wasm' }]);
    });

    it('defers init until DOMContentLoaded when the document is still loading', () => {
      const sandbox = bootWebView({ documentLoading: true });
      expect(sandbox.posted).toEqual([]);

      sandbox.fireDomContentLoaded();
      expect(sandbox.posted).toEqual([{ type: 'ready' }]);
    });
  });

  describe('message hygiene', () => {
    it('ignores malformed JSON frames without crashing', () => {
      const sandbox = bootWebView();
      expect(() => sandbox.send('{definitely not json')).not.toThrow();
      // Only the boot 'ready' frame — no error response leaked.
      expect(sandbox.posted).toEqual([{ type: 'ready' }]);
    });

    it('ignores frames that are neither RPC nor transport messages', () => {
      const sandbox = bootWebView();
      sandbox.send({ hello: 'world' });
      sandbox.send({ id: 'string-id', method: 'pair' }); // id must be a number
      sandbox.send({ id: 1 }); // method missing
      expect(sandbox.posted).toEqual([{ type: 'ready' }]);
    });

    it('accepts messages via the window listener path as well', async () => {
      const sandbox = bootWebView();
      sandbox.sendViaWindow({ id: 5, method: 'pair' });
      await flush();
      // pair without WASM responds with an error — proving dispatch happened.
      expect(sandbox.posted).toContainEqual({ id: 5, error: 'WASM module not loaded' });
    });
  });

  describe('RPC dispatch and pairing state machine', () => {
    it('rejects pair when the WASM module is not loaded', () => {
      const sandbox = bootWebView();
      sandbox.send({ id: 1, method: 'pair' });
      expect(sandbox.posted).toContainEqual({ id: 1, error: 'WASM module not loaded' });
    });

    it('rejects non-pair RPCs before pairing', () => {
      const sandbox = bootWebView();
      sandbox.send({ id: 2, method: 'ethAddress', params: [1] });
      expect(sandbox.posted).toContainEqual({ id: 2, error: 'Not paired. Call pair() first.' });
    });

    it('pairs via PairingBitBox → waitConfirm and answers { id, result: true }', async () => {
      const paired = makePairedFake();
      const { api } = makeBitboxApi(paired);
      const sandbox = bootWebView({ bitboxAPI: api });

      sandbox.send({ id: 3, method: 'pair' });
      await flush();

      expect(api.PairingBitBox).toHaveBeenCalledTimes(1);
      expect(sandbox.posted).toContainEqual({ id: 3, result: true });
    });

    it('reports a pairing failure (user rejected the device code)', async () => {
      const api = {
        default: jest.fn(() => Promise.resolve()),
        PairingBitBox: jest.fn(() => Promise.reject(new Error('pairing rejected'))),
      };
      const sandbox = bootWebView({ bitboxAPI: api });

      sandbox.send({ id: 4, method: 'pair' });
      await flush();

      expect(sandbox.posted).toContainEqual({ id: 4, error: 'Pairing failed: pairing rejected' });
    });

    it('routes async RPCs to the paired instance and returns their result', async () => {
      const paired = makePairedFake();
      const sandbox = bootWebView({ bitboxAPI: makeBitboxApi(paired).api });
      sandbox.send({ id: 5, method: 'pair' });
      await flush();

      sandbox.send({ id: 6, method: 'ethAddress', params: [1, "m/44'/60'/0'/0/0", false] });
      await flush();

      expect(paired.ethAddress).toHaveBeenCalledWith(1, "m/44'/60'/0'/0/0", false);
      expect(sandbox.posted).toContainEqual({ id: 6, result: '0xAddr' });
    });

    it('returns synchronous method results directly', async () => {
      const paired = makePairedFake();
      const sandbox = bootWebView({ bitboxAPI: makeBitboxApi(paired).api });
      sandbox.send({ id: 7, method: 'pair' });
      await flush();

      sandbox.send({ id: 8, method: 'syncMethod', params: [2, 40] });
      expect(sandbox.posted).toContainEqual({ id: 8, result: 42 });
    });

    it('maps async rejections to { id, error } with the original message', async () => {
      const paired = makePairedFake();
      const sandbox = bootWebView({ bitboxAPI: makeBitboxApi(paired).api });
      sandbox.send({ id: 9, method: 'pair' });
      await flush();

      sandbox.send({ id: 10, method: 'failingMethod' });
      await flush();

      expect(sandbox.posted).toContainEqual({ id: 10, error: 'user aborted' });
    });

    it('maps synchronous throws to { id, error }', async () => {
      const paired = makePairedFake();
      const sandbox = bootWebView({ bitboxAPI: makeBitboxApi(paired).api });
      sandbox.send({ id: 11, method: 'pair' });
      await flush();

      sandbox.send({ id: 12, method: 'throwingMethod' });
      expect(sandbox.posted).toContainEqual({ id: 12, error: 'sync boom' });
    });

    it('rejects unknown methods on the paired instance', async () => {
      const paired = makePairedFake();
      const sandbox = bootWebView({ bitboxAPI: makeBitboxApi(paired).api });
      sandbox.send({ id: 13, method: 'pair' });
      await flush();

      sandbox.send({ id: 14, method: 'selfDestruct' });
      expect(sandbox.posted).toContainEqual({ id: 14, error: 'Unknown method: selfDestruct' });
    });

    it('close tears down the paired instance and resets to unpaired', async () => {
      const paired = makePairedFake();
      const sandbox = bootWebView({ bitboxAPI: makeBitboxApi(paired).api });
      sandbox.send({ id: 15, method: 'pair' });
      await flush();

      sandbox.send({ id: 16, method: 'close' });
      expect(paired.close).toHaveBeenCalledTimes(1);
      expect(sandbox.posted).toContainEqual({ id: 16, result: true });

      // After close the session must be gone — RPCs gate on pairing again.
      sandbox.send({ id: 17, method: 'ethAddress' });
      expect(sandbox.posted).toContainEqual({ id: 17, error: 'Not paired. Call pair() first.' });
    });

    it('close before pairing is a safe no-op that still answers', () => {
      const sandbox = bootWebView();
      sandbox.send({ id: 18, method: 'close' });
      expect(sandbox.posted).toContainEqual({ id: 18, result: true });
    });
  });

  describe('transport bridge (WebView ↔ React Native ↔ USB/BLE)', () => {
    async function pairedSandboxWithTransport() {
      const paired = makePairedFake();
      const { api, getTransport } = makeBitboxApi(paired);
      const sandbox = bootWebView({ bitboxAPI: api });
      sandbox.send({ id: 1, method: 'pair' });
      await flush();
      const transport = getTransport();
      expect(transport).not.toBeNull();
      return { sandbox, transport: transport! };
    }

    it('transport.write posts the bytes as a JSON-safe number array', async () => {
      const { sandbox, transport } = await pairedSandboxWithTransport();

      await transport.write(new Uint8Array([0x00, 0x7f, 0xff]).buffer);

      expect(sandbox.posted).toContainEqual({
        type: 'transport_write',
        data: [0x00, 0x7f, 0xff],
      });
    });

    it('transport.read requests bytes and resolves on transport_read_response', async () => {
      const { sandbox, transport } = await pairedSandboxWithTransport();

      const read = transport.read() as Promise<Uint8Array>;
      expect(sandbox.posted).toContainEqual({ type: 'transport_read' });

      sandbox.send({ type: 'transport_read_response', data: [1, 2, 255] });
      await expect(read).resolves.toEqual(new Uint8Array([1, 2, 255]));
    });

    it('a read response without a pending read is dropped silently', () => {
      const sandbox = bootWebView();
      expect(() =>
        sandbox.send({ type: 'transport_read_response', data: [9, 9] }),
      ).not.toThrow();
      expect(sandbox.posted).toEqual([{ type: 'ready' }]);
    });

    it('consecutive reads each get their own response (no stale resolver)', async () => {
      const { sandbox, transport } = await pairedSandboxWithTransport();

      const first = transport.read() as Promise<Uint8Array>;
      sandbox.send({ type: 'transport_read_response', data: [1] });
      await expect(first).resolves.toEqual(new Uint8Array([1]));

      const second = transport.read() as Promise<Uint8Array>;
      sandbox.send({ type: 'transport_read_response', data: [2] });
      await expect(second).resolves.toEqual(new Uint8Array([2]));
    });
  });
});
