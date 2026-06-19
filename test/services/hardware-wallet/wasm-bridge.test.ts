/**
 * Deep tests for the WasmBridge — the RPC seam between React Native and the
 * bitbox-api WASM WebView. Every ceremony (pairing, address, signing) crosses
 * this boundary, so its failure modes are wallet failure modes.
 */
import { WasmBridge } from '@/features/hardware-wallet/services/wasm-bridge';
import { FakeBitboxWebView, FAKE_BITBOX } from '../../helpers/fake-bitbox';

describe('WasmBridge', () => {
  let bridge: WasmBridge;

  beforeEach(() => {
    bridge = new WasmBridge();
  });

  afterEach(() => {
    bridge.destroy();
    jest.useRealTimers();
  });

  describe('call/response protocol', () => {
    it('rejects when no WebView is attached', async () => {
      await expect(bridge.call('pair')).rejects.toThrow('WebView bridge not initialized');
    });

    it('resolves a call with the matching response', async () => {
      const fake = new FakeBitboxWebView('success');
      fake.bindBridge(bridge);

      await expect(bridge.call<string>('ethAddress', [1, "m/44'/60'/0'/0/0", false])).resolves.toBe(
        FAKE_BITBOX.ethAddress,
      );
      expect(fake.calls).toHaveLength(1);
      expect(fake.calls[0]).toMatchObject({
        method: 'ethAddress',
        params: [1, "m/44'/60'/0'/0/0", false],
      });
    });

    it('matches out-of-order responses to the right callers', async () => {
      // Two concurrent calls; the fake answers in arrival order, but the ids
      // must route each result to its own caller even if reordered.
      const sent: { id: number; method: string }[] = [];
      bridge.setWebView({
        postMessage: (raw: string) => {
          const msg = JSON.parse(raw);
          sent.push({ id: msg.id, method: msg.method });
        },
      });

      const first = bridge.call<string>('ethAddress');
      const second = bridge.call<string>('btcAddress');

      // Answer the SECOND call first.
      bridge.onMessage(JSON.stringify({ id: sent[1]!.id, result: 'btc-result' }));
      bridge.onMessage(JSON.stringify({ id: sent[0]!.id, result: 'eth-result' }));

      await expect(second).resolves.toBe('btc-result');
      await expect(first).resolves.toBe('eth-result');
    });

    it('rejects with the error message the WASM side reported', async () => {
      const fake = new FakeBitboxWebView('cancel');
      fake.bindBridge(bridge);
      await bridge.call('pair');

      await expect(bridge.call('ethSign1559Transaction', [])).rejects.toThrow(
        FAKE_BITBOX.errors.cancel,
      );
    });

    it('times out after 30s when the device never answers', async () => {
      jest.useFakeTimers();
      const fake = new FakeBitboxWebView('timeout');
      fake.bindBridge(bridge);

      const call = bridge.call('ethSign1559Transaction', []);
      const assertion = expect(call).rejects.toThrow(
        'WASM bridge call timeout: ethSign1559Transaction',
      );
      jest.advanceTimersByTime(30_000);
      await assertion;
    });

    it('does not resolve a call from a response that arrives after its timeout', async () => {
      jest.useFakeTimers();
      const sent: number[] = [];
      bridge.setWebView({
        postMessage: (raw: string) => sent.push(JSON.parse(raw).id),
      });

      const call = bridge.call('pair');
      const assertion = expect(call).rejects.toThrow('WASM bridge call timeout: pair');
      jest.advanceTimersByTime(30_000);
      await assertion;

      // Late response for the timed-out id must be ignored, not crash.
      expect(() => bridge.onMessage(JSON.stringify({ id: sent[0], result: null }))).not.toThrow();
    });

    it('survives malformed frames and stray ids, then times out', async () => {
      jest.useFakeTimers();
      const fake = new FakeBitboxWebView('malformed');
      fake.bindBridge(bridge);

      const call = bridge.call('ethAddress');
      const assertion = expect(call).rejects.toThrow('WASM bridge call timeout: ethAddress');
      jest.advanceTimersByTime(30_000);
      await assertion;
    });

    it('clears the call timeout once the response arrives (no leaked timer)', async () => {
      // Regression guard: the 30s timeout used to outlive every successful call
      // (it was never cleared), leaking a live timer per RPC — which also made
      // the Jest worker fail to exit gracefully.
      jest.useFakeTimers();
      const sent: number[] = [];
      bridge.setWebView({ postMessage: (raw) => sent.push(JSON.parse(raw).id) });

      const call = bridge.call<string>('ethAddress');
      expect(jest.getTimerCount()).toBe(1); // timeout armed while in flight

      bridge.onMessage(JSON.stringify({ id: sent[0], result: 'eth-result' }));
      await expect(call).resolves.toBe('eth-result');

      // The fix: the timeout is cleared on response — nothing outlives the call.
      expect(jest.getTimerCount()).toBe(0);
    });

    it('clears pending call timeouts on destroy (no leaked timer)', async () => {
      jest.useFakeTimers();
      bridge.setWebView({ postMessage: () => {} });

      const pending = bridge.call('pair');
      const assertion = expect(pending).rejects.toThrow('Bridge destroyed');
      expect(jest.getTimerCount()).toBe(1);

      bridge.destroy();
      await assertion;
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('transport callbacks', () => {
    it('routes transport_write frames to the registered callback', () => {
      const writes: Uint8Array[] = [];
      bridge.onTransportWrite = (data) => {
        writes.push(data);
      };

      bridge.onMessage(JSON.stringify({ type: 'transport_write', data: [1, 2, 3] }));

      expect(writes).toHaveLength(1);
      expect(Array.from(writes[0]!)).toEqual([1, 2, 3]);
    });

    it('routes transport_read requests to the registered callback', () => {
      const reads = jest.fn();
      bridge.onTransportRead = reads;

      bridge.onMessage(JSON.stringify({ type: 'transport_read' }));

      expect(reads).toHaveBeenCalledTimes(1);
    });

    it('sendTransportData forwards bytes to the WebView as JSON-safe arrays', () => {
      const posted: string[] = [];
      bridge.setWebView({ postMessage: (raw) => posted.push(raw) });

      bridge.sendTransportData(new Uint8Array([0xaa, 0xbb]));

      expect(JSON.parse(posted[0]!)).toEqual({
        type: 'transport_read_response',
        data: [0xaa, 0xbb],
      });
    });

    it('ignores transport frames when no callback is registered', () => {
      expect(() =>
        bridge.onMessage(JSON.stringify({ type: 'transport_write', data: [1] })),
      ).not.toThrow();
      expect(() => bridge.onMessage(JSON.stringify({ type: 'transport_read' }))).not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('destroy rejects every pending call and clears callbacks', async () => {
      bridge.setWebView({ postMessage: () => {} });
      bridge.onTransportWrite = jest.fn();
      bridge.onTransportRead = jest.fn();

      const pending = bridge.call('pair');
      const assertion = expect(pending).rejects.toThrow('Bridge destroyed');

      bridge.destroy();
      await assertion;
      expect(bridge.onTransportWrite).toBeNull();
      expect(bridge.onTransportRead).toBeNull();
    });

    it('calls after destroy reject (no WebView)', async () => {
      bridge.setWebView({ postMessage: () => {} });
      bridge.destroy();
      await expect(bridge.call('pair')).rejects.toThrow('WebView bridge not initialized');
    });
  });
});
