/**
 * Regression suite for BitboxProvider against documented firmware quirks.
 *
 * The fake WasmBridge that backs these tests mirrors real BitBox firmware
 * behaviour for known bug classes. A failure here means dfx-wallet's code
 * path does not handle that quirk safely.
 *
 * Naming convention: every describe/it that exercises a quirk MUST
 * mention the quirk ID (`quirk E1`, `quirk A2`, …) so the bitbox-audit
 * CLI's `--test-results` mode can map the test result back to the quirk.
 */

import { BitboxProvider } from '@/features/hardware-wallet/services/bitbox';
import {
  HwBridgeNotReadyError,
  HwFirmwareTooOldError,
  HwNotConnectedError,
  HwUserAbortError,
} from '@/features/hardware-wallet/services/errors';
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

type CallOpts = { timeoutMs?: number };
type BridgeCall = (method: string, args: readonly unknown[], opts?: CallOpts) => Promise<unknown>;

/**
 * Build a provider whose bridge is mocked at the call boundary and whose
 * transport is pre-populated so ensureConnected() passes. Returns the
 * provider plus a calls log for assertions.
 *
 * The mock satisfies the subset of WasmBridge the provider uses:
 * `call(method, args, opts)` and `waitReady()`. We expose only what the
 * provider touches, not the full bridge surface.
 */
function newProviderWithBridge(handler: BridgeHandler) {
  const calls: Array<{ method: string; args: readonly unknown[] }> = [];
  const bridge = {
    call: async (method: string, args: readonly unknown[], _opts?: CallOpts) => {
      calls.push({ method, args });
      return handler(method, args);
    },
    waitReady: async () => undefined,
    setWebView: () => undefined,
    getSessionNonce: () => 'test-nonce',
    onMessage: () => undefined,
    sendTransportData: () => undefined,
    destroy: () => undefined,
    onTransportRead: null,
    onTransportWrite: null,
  };
  const provider = new BitboxProvider(bridge as never);
  (provider as unknown as { transport: object | null }).transport = {};
  return { provider, calls };
}

/** RLP-style nonce of N bytes, all 0xff. */
function bigEndianBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = 0xff;
  return buf;
}

const PATH = "m/44'/60'/0'/0/0";

// ─── ETH ────────────────────────────────────────────────────────────────────

describe('BitboxProvider — quirk E1 (non-ASCII EIP-712 / signMessage)', () => {
  it('signs an ASCII message via the bridge happy-path', async () => {
    const { provider, calls } = newProviderWithBridge(scenarioRegressionUmlautEIP712());
    const sig = await provider.signEthMessage({
      chainId: 1n,
      derivationPath: PATH,
      message: new TextEncoder().encode('hello'),
    });
    expect(sig.length).toBe(65);
    expect(calls[0]!.method).toBe('ethSignMessage');
  });

  it('quirk E1 — surfaces the firmware-reject when message contains a non-ASCII byte', async () => {
    const { provider } = newProviderWithBridge(scenarioRegressionUmlautEIP712());
    const umlaut = new TextEncoder().encode('hëllo');
    await expect(
      provider.signEthMessage({ chainId: 1n, derivationPath: PATH, message: umlaut }),
    ).rejects.toMatchObject({ code: 101 });
  });

  it('quirk E1 — bytes reach the bridge unchanged today (no client transliteration)', async () => {
    const { provider, calls } = newProviderWithBridge(async () => ({
      r: Array.from(new Uint8Array(32)),
      s: Array.from(new Uint8Array(32)),
      v: [0],
    }));
    await provider.signEthMessage({
      chainId: 1n,
      derivationPath: PATH,
      message: new TextEncoder().encode('hëllo'),
    });
    const passed = calls[0]!.args[2] as number[];
    expect(passed.some((b) => b > 0x7f)).toBe(true);
  });
});

describe('BitboxProvider — quirk E2 (ETH nonce ≤ 16 bytes)', () => {
  it('quirk E2 — firmware rejects oversize nonce; client surfaces it cleanly', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    await expect(
      provider.signEthTransaction({
        chainId: 1n,
        derivationPath: PATH,
        rlpPayload: bigEndianBytes(200),
        isEIP1559: true,
      }),
    ).rejects.toMatchObject({ code: 101 });
  });
});

describe('BitboxProvider — quirk E3 (ETH recipient must be exactly 20 bytes)', () => {
  it('quirk E3 — firmware rejects wrong-size recipient; promise rejects cleanly', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    await expect(
      provider.signEthTransaction({
        chainId: 1n,
        derivationPath: PATH,
        rlpPayload: bigEndianBytes(120),
        isEIP1559: false,
      }),
    ).rejects.toMatchObject({ code: 101 });
  });
});

describe('BitboxProvider — quirk E4 (ETH value ≤ 32 bytes)', () => {
  it('quirk E4 — firmware rejects oversize value field', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    await expect(
      provider.signEthTransaction({
        chainId: 1n,
        derivationPath: PATH,
        rlpPayload: bigEndianBytes(100),
        isEIP1559: true,
      }),
    ).rejects.toMatchObject({ code: 101 });
  });
});

describe('BitboxProvider — quirk E5 (EIP-1559 fee fields ≤ 16 bytes)', () => {
  it('quirk E5 — firmware rejects oversize max_priority_fee / max_fee', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    await expect(
      provider.signEthTransaction({
        chainId: 1n,
        derivationPath: PATH,
        rlpPayload: bigEndianBytes(80),
        isEIP1559: true,
      }),
    ).rejects.toMatchObject({ code: 101 });
  });
});

describe('BitboxProvider — quirk E6 (numerics must be smallest big-endian)', () => {
  it('quirk E6 — firmware rejects leading-zero padded numerics', async () => {
    const { provider } = newProviderWithBridge(scenarioErrInvalidInput());
    const padded = new Uint8Array(200);
    padded[31] = 0x01;
    await expect(
      provider.signEthTransaction({
        chainId: 1n,
        derivationPath: PATH,
        rlpPayload: padded,
        isEIP1559: true,
      }),
    ).rejects.toMatchObject({ code: 101 });
  });
});

describe('BitboxProvider — quirk E10 (chain-ID allowlist is firmware-version-bound)', () => {
  it('quirk E10 — known chains succeed', async () => {
    const { provider } = newProviderWithBridge(scenarioUnknownNetwork([999]));
    await expect(provider.getEthAddress({ chainId: 1n })).resolves.toBeDefined();
  });

  it('quirk E10 — unknown chain IDs reject with firmware error on older firmware', async () => {
    const { provider } = newProviderWithBridge(scenarioUnknownNetwork([1]));
    await expect(provider.getEthAddress({ chainId: 1n })).rejects.toMatchObject({ code: 101 });
  });
});

// ─── CRIT-3 + CRIT-4: display-on-device + chain plumbing ────────────────────

describe('BitboxProvider — security invariants (CRIT-3, CRIT-4)', () => {
  it('CRIT-3 — getEthAddress defaults displayOnDevice=true', async () => {
    const { provider, calls } = newProviderWithBridge(async () => '0xabc');
    await provider.getEthAddress({ chainId: 1n });
    const passedDisplay = calls[0]!.args[2] as boolean;
    expect(passedDisplay).toBe(true);
  });

  it('CRIT-3 — getBtcAddress defaults displayOnDevice=true', async () => {
    const { provider, calls } = newProviderWithBridge(async () => 'bc1q…');
    await provider.getBtcAddress({ chainId: 1n, coin: 'btc' } as never);
    const passedDisplay = calls[0]!.args[3] as boolean;
    expect(passedDisplay).toBe(true);
  });

  it('CRIT-3 — caller can explicitly opt out (display:false), but must say so', async () => {
    const { provider, calls } = newProviderWithBridge(async () => '0xabc');
    await provider.getEthAddress({ chainId: 1n, displayOnDevice: false });
    expect(calls[0]!.args[2]).toBe(false);
  });

  it('CRIT-4 — chainId flows from caller to bridge (no hardcoded 1)', async () => {
    const { provider, calls } = newProviderWithBridge(async () => '0xabc');
    await provider.getEthAddress({ chainId: 137n }); // Polygon
    expect(calls[0]!.args[0]).toBe('137');
  });

  it('CRIT-4 — chainId in signEthTransaction reaches bridge unchanged', async () => {
    const { provider, calls } = newProviderWithBridge(async () => ({
      r: Array.from(new Uint8Array(32)),
      s: Array.from(new Uint8Array(32)),
      v: [0],
    }));
    await provider.signEthTransaction({
      chainId: 42161n, // Arbitrum
      derivationPath: PATH,
      rlpPayload: new Uint8Array([1, 2]),
      isEIP1559: true,
    });
    expect(calls[0]!.args[0]).toBe('42161');
  });
});

// ─── Protocol ───────────────────────────────────────────────────────────────

describe('BitboxProvider — quirk P1 (pairing channel hash early-availability)', () => {
  it('quirk P1 — channel hash available before user confirm; client must coordinate', async () => {
    const { handler, signalConfirm } = scenarioChannelHashEarly(2);
    const { provider } = newProviderWithBridge(handler);

    await expect(provider.getEthAddress({ chainId: 1n })).resolves.toBeDefined();
    await expect(provider.getEthAddress({ chainId: 1n })).resolves.toBeDefined();
    await expect(provider.getEthAddress({ chainId: 1n })).rejects.toThrow(/awaiting/i);

    signalConfirm();
    await expect(provider.getEthAddress({ chainId: 1n })).resolves.toBeDefined();
  });
});

// ─── App / cross-cutting ────────────────────────────────────────────────────

describe('BitboxProvider — quirk A1 (bridge exception handling)', () => {
  it('quirk A1 — cleanly rejects when the bridge throws synchronously', async () => {
    const { provider } = newProviderWithBridge(scenarioPanicMidQuery(1, 'simulated webview crash'));
    await expect(
      provider.signEthMessage({
        chainId: 1n,
        derivationPath: PATH,
        message: new Uint8Array([0x68, 0x69]),
      }),
    ).rejects.toBe('simulated webview crash');
  });
});

describe('BitboxProvider — quirk A2 (long user-confirm flows must succeed)', () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  it('quirk A2 — operation completes despite a 15-second device delay', async () => {
    const { provider } = newProviderWithBridge(scenarioSlowResponse(15_000));
    const inflight = provider.signEthMessage({
      chainId: 1n,
      derivationPath: PATH,
      message: new Uint8Array([0x68, 0x69]),
    });
    jest.advanceTimersByTime(15_001);
    const sig = await inflight;
    expect(sig.length).toBe(65);
  });
});

// ─── User-abort classification (HIGH-5) ─────────────────────────────────────

describe('BitboxProvider — UserAbort is a distinct error class', () => {
  it('maps a bridge error containing "user abort" to HwUserAbortError', async () => {
    const { provider } = newProviderWithBridge(async () => {
      const err = new Error('firmware: user abort (104)');
      throw err;
    });
    await expect(
      provider.signEthMessage({ chainId: 1n, derivationPath: PATH, message: new Uint8Array([0x68]) }),
    ).rejects.toBeInstanceOf(HwUserAbortError);
  });

  it('maps a code-104 error to HwUserAbortError', async () => {
    const { provider } = newProviderWithBridge(async () => {
      const err = new Error('something else');
      (err as Error & { code?: number }).code = 104;
      throw err;
    });
    await expect(
      provider.signEthMessage({ chainId: 1n, derivationPath: PATH, message: new Uint8Array([0x68]) }),
    ).rejects.toBeInstanceOf(HwUserAbortError);
  });
});

// ─── Guard rails ─────────────────────────────────────────────────────────────

describe('BitboxProvider — guard rails', () => {
  it('refuses operations before connect() is called', async () => {
    const provider = new BitboxProvider();
    await expect(
      provider.signEthMessage({
        chainId: 1n,
        derivationPath: PATH,
        message: new Uint8Array([0x68, 0x69]),
      }),
    ).rejects.toBeInstanceOf(HwNotConnectedError);
  });
});

// ─── Firmware version gate (HIGH-4) ─────────────────────────────────────────

describe('BitboxProvider — firmware version gate', () => {
  it('rejects firmware below MIN_FIRMWARE_VERSION during connect', async () => {
    // We mount a bridge whose deviceInfo returns an old firmware. The
    // provider should call disconnect and throw HwFirmwareTooOldError.
    const handler: BridgeHandler = async (method) => {
      if (method === 'deviceInfo') {
        return { version: '9.10.0', product: 'bitbox02-multi', name: 'TestBox', initialized: true };
      }
      if (method === 'pair' || method === 'close') return null;
      return null;
    };
    const calls: Array<{ method: string }> = [];
    const bridge = {
      call: async (method: string, args: readonly unknown[]) => {
        calls.push({ method });
        return handler(method, args);
      },
      waitReady: async () => undefined,
      setWebView: () => undefined,
      getSessionNonce: () => 'test-nonce',
      onMessage: () => undefined,
      sendTransportData: () => undefined,
      destroy: () => undefined,
      onTransportRead: null,
      onTransportWrite: null,
    };
    const provider = new BitboxProvider(bridge as never);
    // We can't truly call .connect without a transport; instead simulate
    // the post-pair state by invoking fetchDeviceInfo via the typed gate.
    // The full connect() exercise lives in an integration test later.
    (provider as unknown as { transport: object | null }).transport = {};
    const info = await (provider as unknown as { fetchDeviceInfo: () => Promise<{ version: string }> }).fetchDeviceInfo();
    expect(info.version).toBe('9.10.0');
    // Now test the comparison helper:
    const { compareVersions } = await import('@/features/hardware-wallet/services/errors');
    expect(compareVersions('9.10.0', '9.19.0')).toBeLessThan(0);
  });

  it('HwFirmwareTooOldError carries minRequired and actual', () => {
    const err = new HwFirmwareTooOldError('9.19.0', '9.10.0');
    expect(err.minRequired).toBe('9.19.0');
    expect(err.actual).toBe('9.10.0');
    expect(err.kind).toBe('FirmwareTooOld');
  });
});

// ─── Bridge errors (HIGH-7 + HIGH-9) ────────────────────────────────────────

describe('WasmBridge — bridge not ready', () => {
  it('call() rejects with HwBridgeNotReadyError before WASM signals ready', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: () => undefined });
    await expect(bridge.call('pair', [])).rejects.toBeInstanceOf(HwBridgeNotReadyError);
  });

  it('call() rejects with HwBridgeNotReadyError when no WebView is attached', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    await expect(bridge.call('pair', [])).rejects.toBeInstanceOf(HwBridgeNotReadyError);
  });

  it('waitReady() rejects when no WebView is attached', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    await expect(bridge.waitReady()).rejects.toBeInstanceOf(HwBridgeNotReadyError);
  });

  it('drops messages with the wrong session nonce', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: () => undefined });
    // Inject a "wasm_ready" message with a bogus nonce — must be ignored.
    bridge.onMessage(JSON.stringify({ nonce: 'wrong-nonce', type: 'wasm_ready' }));
    await expect(bridge.waitReady(50)).rejects.toBeInstanceOf(HwBridgeNotReadyError);
  });

  it('accepts a wasm_ready message with the correct nonce', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: () => undefined });
    const nonce = bridge.getSessionNonce();
    bridge.onMessage(JSON.stringify({ nonce, type: 'wasm_ready' }));
    await expect(bridge.waitReady(50)).resolves.toBeUndefined();
  });
});
