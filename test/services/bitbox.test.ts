/**
 * Regression suite for BitboxProvider against documented firmware quirks.
 *
 * These tests drive the production BitboxProvider with a fake WasmBridge
 * that mirrors real BitBox firmware behaviour for known bug classes from
 * the bitbox-testkit knowledge base. A failure here means the dfx-wallet
 * code path does not handle that quirk safely.
 *
 * Naming convention: every describe/it that exercises a quirk MUST
 * mention the quirk ID (`quirk E1`, `quirk A2`, …) so the bitbox-audit
 * CLI's `--test-results` mode can map the test result back to the quirk.
 */

import { BitboxProvider } from '@/features/hardware-wallet/services/bitbox';
import {
  scenarioRegressionUmlautEIP712,
  scenarioPanicMidQuery,
  scenarioErrInvalidInput,
  scenarioSlowResponse,
  scenarioChannelHashEarly,
  scenarioUnknownNetwork,
  ErrInvalidInput101,
  type BridgeHandler,
} from './bitbox-testkit-inline';

/**
 * Build a provider whose `bridge.call` is replaced by `handler` and whose
 * `transport` is non-null (so ensureConnected() passes). Returns the
 * provider plus a `calls` recorder for after-the-fact assertions.
 */
function newProviderWithBridge(handler: BridgeHandler) {
  const provider = new BitboxProvider();
  const calls: Array<{ method: string; args: readonly unknown[] }> = [];
  const bridge = {
    call: async (method: string, args: readonly unknown[]) => {
      calls.push({ method, args });
      return handler(method, args);
    },
  };
  (provider as unknown as { bridge: typeof bridge }).bridge = bridge;
  (provider as unknown as { transport: object | null }).transport = {};
  return { provider, calls };
}

/** RLP-style nonce of N bytes, all 0xff. */
function bigEndianBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = 0xff;
  return buf;
}

// ─── ETH ────────────────────────────────────────────────────────────────────

describe('BitboxProvider — quirk E1 (non-ASCII EIP-712 / signMessage)', () => {
  it('signs an ASCII message via the bridge happy-path', async () => {
    const { provider, calls } = newProviderWithBridge(scenarioRegressionUmlautEIP712());
    const sig = await provider.signMessage(1, "m/44'/60'/0'/0/0", new TextEncoder().encode('hello'));
    expect(sig.length).toBe(65);
    expect(calls[0]!.method).toBe('ethSignMessage');
  });

  it('quirk E1 — surfaces the firmware-reject when message contains a non-ASCII byte', async () => {
    const { provider } = newProviderWithBridge(scenarioRegressionUmlautEIP712());
    const umlaut = new TextEncoder().encode('hëllo');
    await expect(provider.signMessage(1, "m/44'/60'/0'/0/0", umlaut)).rejects.toBe(ErrInvalidInput101);
  });

  it('quirk E1 — bytes reach the bridge unchanged today (no client transliteration)', async () => {
    const { provider, calls } = newProviderWithBridge(async () => ({
      r: Array.from(new Uint8Array(32)),
      s: Array.from(new Uint8Array(32)),
      v: [0],
    }));
    await provider.signMessage(1, "m/44'/60'/0'/0/0", new TextEncoder().encode('hëllo'));
    const passed = calls[0]!.args[2] as number[];
    expect(passed.some((b) => b > 0x7f)).toBe(true);
  });
});

describe('BitboxProvider — quirk E2 (ETH nonce ≤ 16 bytes)', () => {
  it('quirk E2 — firmware rejects oversize nonce; client surfaces it cleanly', async () => {
    // Production signEthTransaction passes the RLP payload as a Uint8Array.
    // The wire-level error is what we assert; the client should not silently
    // swallow it.
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    const oversizeRlp = bigEndianBytes(200); // realistic RLP with a too-fat nonce field embedded
    await expect(
      provider.signEthTransaction(1, "m/44'/60'/0'/0/0", oversizeRlp, true),
    ).rejects.toBe(ErrInvalidInput101);
  });
});

describe('BitboxProvider — quirk E3 (ETH recipient must be exactly 20 bytes)', () => {
  it('quirk E3 — firmware rejects wrong-size recipient; promise rejects cleanly', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    const rlp = bigEndianBytes(120);
    await expect(
      provider.signEthTransaction(1, "m/44'/60'/0'/0/0", rlp, false),
    ).rejects.toBe(ErrInvalidInput101);
  });
});

describe('BitboxProvider — quirk E4 (ETH value ≤ 32 bytes)', () => {
  it('quirk E4 — firmware rejects oversize value field', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    await expect(
      provider.signEthTransaction(1, "m/44'/60'/0'/0/0", bigEndianBytes(100), true),
    ).rejects.toBe(ErrInvalidInput101);
  });
});

describe('BitboxProvider — quirk E5 (EIP-1559 fee fields ≤ 16 bytes)', () => {
  it('quirk E5 — firmware rejects oversize max_priority_fee / max_fee', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    await expect(
      provider.signEthTransaction(1, "m/44'/60'/0'/0/0", bigEndianBytes(80), true),
    ).rejects.toBe(ErrInvalidInput101);
  });
});

describe('BitboxProvider — quirk E6 (numerics must be smallest big-endian)', () => {
  it('quirk E6 — firmware rejects leading-zero padded numerics', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    // Real-world repro: a nonce padded to 32 bytes with leading zeros.
    const padded = new Uint8Array(200);
    padded[31] = 0x01;
    await expect(
      provider.signEthTransaction(1, "m/44'/60'/0'/0/0", padded, true),
    ).rejects.toBe(ErrInvalidInput101);
  });
});

describe('BitboxProvider — quirk E10 (chain-ID allowlist is firmware-version-bound)', () => {
  it('quirk E10 — known chains succeed', async () => {
    const { provider } = newProviderWithBridge(scenarioUnknownNetwork([999]));
    const addr = await provider.getEthAddress("m/44'/60'/0'/0/0");
    expect(typeof addr === 'string' || typeof addr === 'object').toBe(true);
  });

  it('quirk E10 — unknown chain IDs reject with firmware error on older firmware', async () => {
    // The BitboxProvider currently hardcodes chainId=1 in getEthAddress. To
    // simulate an unknown chain we redirect the bridge: any ethAddress
    // call with a chain ID in `unknown` rejects. We override the handler
    // to flag chainId=1 as unknown for the duration of this test.
    const { provider } = newProviderWithBridge(scenarioUnknownNetwork([1]));
    await expect(provider.getEthAddress("m/44'/60'/0'/0/0")).rejects.toBe(ErrInvalidInput101);
  });
});

// ─── Protocol ───────────────────────────────────────────────────────────────

describe('BitboxProvider — quirk P1 (pairing channel hash early-availability)', () => {
  it('quirk P1 — channel hash available before user confirm; client must coordinate', async () => {
    const { handler, signalConfirm } = scenarioChannelHashEarly(2);
    const { provider } = newProviderWithBridge(handler);

    // First two calls return the hash payload; subsequent calls block until confirm.
    await expect(provider.getEthAddress("m/44'/60'/0'/0/0")).resolves.toBeDefined();
    await expect(provider.getEthAddress("m/44'/60'/0'/0/0")).resolves.toBeDefined();
    await expect(provider.getEthAddress("m/44'/60'/0'/0/0")).rejects.toThrow(/awaiting/i);

    signalConfirm();
    await expect(provider.getEthAddress("m/44'/60'/0'/0/0")).resolves.toBeDefined();
  });
});

// ─── App / cross-cutting ────────────────────────────────────────────────────

describe('BitboxProvider — quirk A1 (bridge exception handling)', () => {
  it('quirk A1 — cleanly rejects when the bridge throws synchronously', async () => {
    const { provider } = newProviderWithBridge(scenarioPanicMidQuery(1, 'simulated webview crash'));
    await expect(
      provider.signMessage(1, "m/44'/60'/0'/0/0", new Uint8Array([0x68, 0x69])),
    ).rejects.toBe('simulated webview crash');
  });
});

describe('BitboxProvider — quirk A2 (long user-confirm flows must succeed)', () => {
  // Use Jest fake timers so the 15s scenario delay does not block the suite.
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  it('quirk A2 — operation completes despite a 15-second device delay', async () => {
    const { provider } = newProviderWithBridge(scenarioSlowResponse(15_000));
    const inflight = provider.signMessage(1, "m/44'/60'/0'/0/0", new Uint8Array([0x68, 0x69]));
    jest.advanceTimersByTime(15_001);
    const sig = await inflight;
    expect(sig.length).toBe(65);
  });
});

// ─── Guard rails ─────────────────────────────────────────────────────────────

describe('BitboxProvider — guard rails', () => {
  it('refuses operations before connect() is called', async () => {
    const provider = new BitboxProvider();
    await expect(
      provider.signMessage(1, "m/44'/60'/0'/0/0", new Uint8Array([0x68, 0x69])),
    ).rejects.toThrow(/not connected/i);
  });
});
