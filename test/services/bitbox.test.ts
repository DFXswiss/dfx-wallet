/**
 * Regression suite for BitboxProvider against documented firmware quirks.
 *
 * These tests drive the production BitboxProvider with a fake WasmBridge
 * that mirrors real BitBox firmware behaviour for known bug classes from
 * the bitbox-testkit knowledge base. A failure here means the dfx-wallet
 * code path does not handle that quirk safely.
 */

import { BitboxProvider } from '@/features/hardware-wallet/services/bitbox';
import {
  scenarioRegressionUmlautEIP712,
  scenarioPanicMidQuery,
  ErrInvalidInput101,
} from './bitbox-testkit-inline';

type BridgeCall = (method: string, args: readonly unknown[]) => Promise<unknown>;

/**
 * Build a provider whose `bridge.call` is replaced by `handler` and whose
 * `transport` is non-null (so ensureConnected() passes). Returns the
 * provider plus a `calls` recorder for after-the-fact assertions.
 */
function newProviderWithBridge(handler: BridgeCall) {
  const provider = new BitboxProvider();
  const calls: Array<{ method: string; args: readonly unknown[] }> = [];
  const bridge = {
    call: async (method: string, args: readonly unknown[]) => {
      calls.push({ method, args });
      return handler(method, args);
    },
  };
  // Swap private fields. The production code reads them through `this.`,
  // not through any encapsulation barrier, so this is safe.
  (provider as unknown as { bridge: typeof bridge }).bridge = bridge;
  (provider as unknown as { transport: object | null }).transport = {};
  return { provider, calls };
}

describe('BitboxProvider — quirk E1 (non-ASCII EIP-712 / signMessage)', () => {
  it('signs an ASCII message via the bridge happy-path', async () => {
    const { provider, calls } = newProviderWithBridge(scenarioRegressionUmlautEIP712());
    const ascii = new TextEncoder().encode('hello');

    const sig = await provider.signMessage(1, "m/44'/60'/0'/0/0", ascii);

    expect(sig).toBeInstanceOf(Uint8Array);
    expect(sig.length).toBe(65);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('ethSignMessage');
  });

  it('surfaces the firmware-reject when message contains a non-ASCII byte', async () => {
    const { provider } = newProviderWithBridge(scenarioRegressionUmlautEIP712());
    const umlaut = new TextEncoder().encode('hëllo');

    await expect(provider.signMessage(1, "m/44'/60'/0'/0/0", umlaut)).rejects.toBe(ErrInvalidInput101);
  });

  /**
   * Documents the current behaviour: dfx-wallet does NOT transliterate
   * before sending to the firmware. The previous test surfaces the
   * firmware error directly. If a future revision adds NFKD + ASCII
   * fallback inside BitboxProvider.signMessage, this test should be
   * inverted to assert the transliterated bytes reach the bridge.
   */
  it('exposes that no client-side transliteration happens today', async () => {
    const { provider, calls } = newProviderWithBridge(async () => ({
      r: Array.from(new Uint8Array(32)),
      s: Array.from(new Uint8Array(32)),
      v: [0],
    }));
    const umlaut = new TextEncoder().encode('hëllo');

    await provider.signMessage(1, "m/44'/60'/0'/0/0", umlaut);

    const passedBytes = calls[0]!.args[2] as number[];
    const hasNonAscii = passedBytes.some((b) => b > 0x7f);
    expect(hasNonAscii).toBe(true); // bytes reached the bridge unchanged
  });
});

describe('BitboxProvider — quirk A1 (bridge exception handling)', () => {
  it('cleanly rejects when the bridge throws synchronously', async () => {
    const { provider } = newProviderWithBridge(scenarioPanicMidQuery(1, 'simulated webview crash'));

    await expect(provider.signMessage(1, "m/44'/60'/0'/0/0", new Uint8Array([0x68, 0x69]))).rejects.toBe(
      'simulated webview crash',
    );
  });
});

describe('BitboxProvider — guard rails', () => {
  it('refuses operations before connect() is called', async () => {
    const provider = new BitboxProvider();
    await expect(provider.signMessage(1, "m/44'/60'/0'/0/0", new Uint8Array([0x68, 0x69]))).rejects.toThrow(
      /not connected/i,
    );
  });
});
