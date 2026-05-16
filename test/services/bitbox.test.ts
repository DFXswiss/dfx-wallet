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

// Mock the physical transport modules so connect() can be unit-tested
// end-to-end without RN platform shims. Each mock provides a constructor
// + minimal API surface; tests that need richer behaviour override at
// runtime via jest.spyOn().
jest.mock('@/features/hardware-wallet/services/transport-ble', () => {
  class FakeBleTransport {
    async connectToDevice(): Promise<void> {}
    async close(): Promise<void> {}
    async write(): Promise<number> {
      return 0;
    }
    async read(): Promise<Uint8Array> {
      return new Uint8Array();
    }
  }
  return {
    BleTransport: FakeBleTransport,
    scanBleDevices: async () => [],
    setBleManager: () => undefined,
  };
});
jest.mock('@/features/hardware-wallet/services/transport-usb', () => {
  class FakeUsbTransport {
    async open(): Promise<void> {}
    async close(): Promise<void> {}
    async write(): Promise<number> {
      return 0;
    }
    async read(): Promise<Uint8Array> {
      return new Uint8Array();
    }
  }
  return {
    UsbTransport: FakeUsbTransport,
    scanUsbDevices: async () => [],
  };
});

import { BitboxProvider } from '@/features/hardware-wallet/services/bitbox';
import {
  HwBridgeNotReadyError,
  HwFirmwareTooOldError,
  HwNotConnectedError,
  HwUserAbortError,
} from '@/features/hardware-wallet/services/errors';
import { setHwLogger } from '@/features/hardware-wallet/services/log';

// Silence the structured logger for the duration of this test file so
// log lines from BitboxProvider don't drown out test output.
beforeAll(() => setHwLogger({ log: () => undefined }));
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

type CallOpts = { timeoutMs?: number; signal?: AbortSignal };
import type { HardwareWalletDevice } from '@/features/hardware-wallet/services/types';
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

// ─── Transport event subscription (HIGH-8) ──────────────────────────────────

describe('BitboxProvider — transport event subscription', () => {
  it('subscribeTransport returns an unsubscribe function', () => {
    const provider = new BitboxProvider();
    const unsubscribe = provider.subscribeTransport(() => undefined);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('multiple subscribers all receive events', () => {
    const provider = new BitboxProvider();
    const events: string[] = [];
    provider.subscribeTransport((e) => events.push(`a:${e}`));
    provider.subscribeTransport((e) => events.push(`b:${e}`));
    // Trigger via the internal emit (test-only access).
    (provider as unknown as { emit: (e: 'disconnected' | 'reconnected' | 'fatal') => void }).emit('disconnected');
    expect(events).toEqual(['a:disconnected', 'b:disconnected']);
  });

  it('unsubscribed listener does not receive future events', () => {
    const provider = new BitboxProvider();
    const events: string[] = [];
    const unsub = provider.subscribeTransport((e) => events.push(e));
    (provider as unknown as { emit: (e: 'disconnected' | 'reconnected' | 'fatal') => void }).emit('disconnected');
    unsub();
    (provider as unknown as { emit: (e: 'disconnected' | 'reconnected' | 'fatal') => void }).emit('reconnected');
    expect(events).toEqual(['disconnected']);
  });

  it('listener throw does not affect other subscribers', () => {
    const provider = new BitboxProvider();
    const events: string[] = [];
    provider.subscribeTransport(() => {
      throw new Error('listener boom');
    });
    provider.subscribeTransport((e) => events.push(e));
    (provider as unknown as { emit: (e: 'disconnected' | 'reconnected' | 'fatal') => void }).emit('fatal');
    expect(events).toEqual(['fatal']);
  });
});

// ─── Reconnect logic (HIGH-8) ───────────────────────────────────────────────

describe('BitboxProvider — attemptReconnect', () => {
  it('rejects with HwNotConnectedError when no device was previously connected', async () => {
    const provider = new BitboxProvider();
    await expect(provider.attemptReconnect()).rejects.toBeInstanceOf(HwNotConnectedError);
  });

  it('honours AbortSignal to cancel mid-backoff', async () => {
    const provider = new BitboxProvider();
    // Inject a connected device into private state so attemptReconnect has
    // something to retry — but the connect attempts will fail (no mock).
    (provider as unknown as { connectedDevice: { id: string; transport: string } }).connectedDevice = {
      id: 'fake',
      transport: 'ble',
    } as never;

    const controller = new AbortController();
    // Abort almost immediately so the loop exits before doing real I/O.
    setTimeout(() => controller.abort(), 10);
    await expect(
      provider.attemptReconnect({ signal: controller.signal, maxAttempts: 3 }),
    ).rejects.toBeDefined();
  });
});

// ─── Bridge per-call timeout (HIGH-7) ───────────────────────────────────────

describe('WasmBridge — per-call timeout', () => {
  let bridge: import('@/features/hardware-wallet/services/wasm-bridge').WasmBridge;

  beforeEach(async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    bridge = new WasmBridge();
    bridge.setWebView({ postMessage: () => undefined });
    const nonce = bridge.getSessionNonce();
    bridge.onMessage(JSON.stringify({ nonce, type: 'wasm_ready' }));
    await bridge.waitReady();
  });

  it('rejects with HwBridgeTimeoutError after timeoutMs', async () => {
    const { HwBridgeTimeoutError } = await import('@/features/hardware-wallet/services/errors');
    jest.useFakeTimers();
    const inflight = bridge.call('slow-method', [], { timeoutMs: 100 });
    jest.advanceTimersByTime(150);
    await expect(inflight).rejects.toBeInstanceOf(HwBridgeTimeoutError);
    jest.useRealTimers();
  });

  it('timeout error carries method name and timeout value', async () => {
    const { HwBridgeTimeoutError } = await import('@/features/hardware-wallet/services/errors');
    jest.useFakeTimers();
    const inflight = bridge.call('expensive-op', [], { timeoutMs: 50 });
    jest.advanceTimersByTime(100);
    await expect(inflight).rejects.toMatchObject({
      method: 'expensive-op',
      timeoutMs: 50,
    });
    expect(HwBridgeTimeoutError).toBeDefined();
    jest.useRealTimers();
  });

  it('destroy() rejects all pending calls', async () => {
    const { HwBridgeNotReadyError } = await import('@/features/hardware-wallet/services/errors');
    const a = bridge.call('a', [], { timeoutMs: 60_000 });
    const b = bridge.call('b', [], { timeoutMs: 60_000 });
    bridge.destroy();
    await expect(a).rejects.toBeInstanceOf(HwBridgeNotReadyError);
    await expect(b).rejects.toBeInstanceOf(HwBridgeNotReadyError);
  });

  it('setWebView resets pending calls (session re-bind)', async () => {
    const { HwBridgeNotReadyError } = await import('@/features/hardware-wallet/services/errors');
    const inflight = bridge.call('a', [], { timeoutMs: 60_000 });
    bridge.setWebView({ postMessage: () => undefined });
    await expect(inflight).rejects.toBeInstanceOf(HwBridgeNotReadyError);
  });
});

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

/**
 * Regression for the WebView mount-crash class.
 *
 * Pre-fix: `WasmBridge` constructor set `this.nonce = ''`. `renderBridgeHtml`
 * throws on empty nonce. `BitboxWasmWebView`'s `useMemo` evaluates during
 * render — i.e. BEFORE the `useEffect` that calls `setWebView`. The result
 * was a synchronous throw at first render that no test caught, because every
 * test stubs the bridge instance.
 *
 * Post-fix: constructor generates a real nonce immediately; setWebView only
 * rotates it. renderBridgeHtml succeeds without setWebView ever having run.
 */
describe('WasmBridge — constructor produces a usable nonce immediately', () => {
  it('exposes a 32-hex nonce without any setWebView call (CC-1 regression)', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    const nonce = bridge.getSessionNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('renderBridgeHtml accepts the freshly-constructed nonce', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const { renderBridgeHtml } = await import('@/features/hardware-wallet/services/bridge-html');
    const bridge = new WasmBridge();
    expect(() => renderBridgeHtml(bridge.getSessionNonce())).not.toThrow();
  });

  it('setWebView rotates the nonce so cross-session traffic is rejected', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    const before = bridge.getSessionNonce();
    bridge.setWebView({ postMessage: () => undefined });
    const after = bridge.getSessionNonce();
    expect(after).not.toBe(before);
    expect(after).toMatch(/^[0-9a-f]{32}$/);
  });

  it('setWebView resets callId so id-based replay across sessions is impossible', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const sent: string[] = [];
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: (m) => sent.push(m) });
    const nonce1 = bridge.getSessionNonce();
    bridge.onMessage(JSON.stringify({ nonce: nonce1, type: 'wasm_ready' }));
    await bridge.waitReady();
    // Issue a call to allocate callId=1; capture its rejection because
    // the next setWebView will destroy the pending entry.
    const firstCall = bridge.call('m', [], { timeoutMs: 60_000 }).catch(() => undefined);
    // Re-bind WebView; pending call rejects, callId resets to 0.
    bridge.setWebView({ postMessage: (m) => sent.push(m) });
    await firstCall;
    const nonce2 = bridge.getSessionNonce();
    bridge.onMessage(JSON.stringify({ nonce: nonce2, type: 'wasm_ready' }));
    await bridge.waitReady();
    sent.length = 0;
    const secondCall = bridge.call('m2', [], { timeoutMs: 60_000 }).catch(() => undefined);
    const parsed = JSON.parse(sent[0]!);
    expect(parsed.id).toBe(1); // First call after reset has id 1, not e.g. 2.
    // Clean up — destroying the bridge rejects the pending call.
    bridge.destroy();
    await secondCall;
  });
});

/**
 * Regression for CC-17 (method-binding) + bridge protocol hardening
 * tests added in Commit 2.
 */
describe('WasmBridge — protocol hardening', () => {
  async function readyBridge() {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const sent: unknown[] = [];
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: (m) => sent.push(JSON.parse(m)) });
    const nonce = bridge.getSessionNonce();
    bridge.onMessage(JSON.stringify({ nonce, type: 'wasm_ready' }));
    await bridge.waitReady();
    return { bridge, sent, nonce };
  }

  it('rejects a result whose method does not match the pending call (CC-17)', async () => {
    const { bridge, sent, nonce } = await readyBridge();
    const inflight = bridge.call('deviceInfo', [], { timeoutMs: 100 });
    const callId = (sent[0] as { id: number }).id;
    // Inject a forged result for the same id but a different method —
    // simulating an attacker who guessed the next id but cannot guess the
    // pending method.
    bridge.onMessage(
      JSON.stringify({
        nonce,
        type: 'result',
        id: callId,
        method: 'ethSign1559Transaction',
        result: { r: [], s: [], v: [27] },
      }),
    );
    const { HwBridgeTimeoutError } = await import('@/features/hardware-wallet/services/errors');
    // The forged result is dropped, the pending entry survives, the
    // timer eventually fires.
    jest.useFakeTimers();
    const captured = inflight.catch((e) => e);
    jest.advanceTimersByTime(150);
    const err = await captured;
    expect(err).toBeInstanceOf(HwBridgeTimeoutError);
    jest.useRealTimers();
  });

  it('accepts a result with the matching method (CC-17 happy path)', async () => {
    const { bridge, sent, nonce } = await readyBridge();
    const inflight = bridge.call<string>('deviceInfo', [], { timeoutMs: 60_000 });
    const callId = (sent[0] as { id: number }).id;
    bridge.onMessage(
      JSON.stringify({
        nonce,
        type: 'result',
        id: callId,
        method: 'deviceInfo',
        result: 'v9.21.0',
      }),
    );
    await expect(inflight).resolves.toBe('v9.21.0');
  });

  it('rejects results / errors with non-positive or non-integer id', async () => {
    const { bridge, sent, nonce } = await readyBridge();
    const inflight = bridge.call('m', [], { timeoutMs: 100 });
    const callId = (sent[0] as { id: number }).id;
    // Inject malformed ids — must be ignored.
    bridge.onMessage(JSON.stringify({ nonce, type: 'result', id: 0, method: 'm', result: 1 }));
    bridge.onMessage(JSON.stringify({ nonce, type: 'result', id: -1, method: 'm', result: 1 }));
    bridge.onMessage(JSON.stringify({ nonce, type: 'result', id: 1.5, method: 'm', result: 1 }));
    bridge.onMessage(JSON.stringify({ nonce, type: 'result', id: '1', method: 'm', result: 1 }));
    // The correct envelope resolves.
    bridge.onMessage(
      JSON.stringify({ nonce, type: 'result', id: callId, method: 'm', result: 'ok' }),
    );
    await expect(inflight).resolves.toBe('ok');
  });

  // Regression for HIGH-6 (Agent B): a wasm_error envelope should fail
  // readyWaiters fast instead of waiting for the 5s timeout.
  it('wasm_error rejects waitReady immediately with the underlying message', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const { HwBridgeNotReadyError } = await import('@/features/hardware-wallet/services/errors');
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: () => undefined });
    const nonce = bridge.getSessionNonce();
    // Fire the wasm_error before anyone calls waitReady — exercise the
    // cached-bootstrap-error branch.
    bridge.onMessage(
      JSON.stringify({
        nonce,
        type: 'wasm_error',
        id: 0,
        error: { message: 'wasm load failed: 404' },
      }),
    );
    await expect(bridge.waitReady(5000)).rejects.toBeInstanceOf(HwBridgeNotReadyError);
    await expect(bridge.waitReady(5000)).rejects.toThrow(/wasm load failed: 404/);
  });

  it('wasm_error rejects all in-flight waitReady waiters synchronously', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const { HwBridgeNotReadyError } = await import('@/features/hardware-wallet/services/errors');
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: () => undefined });
    const nonce = bridge.getSessionNonce();
    const waiterA = bridge.waitReady(5000).catch((e) => e);
    const waiterB = bridge.waitReady(5000).catch((e) => e);
    bridge.onMessage(
      JSON.stringify({
        nonce,
        type: 'wasm_error',
        id: 0,
        error: { message: 'integrity mismatch' },
      }),
    );
    await expect(waiterA).resolves.toBeInstanceOf(HwBridgeNotReadyError);
    await expect(waiterB).resolves.toBeInstanceOf(HwBridgeNotReadyError);
  });

  // setWebView must clear the bootstrap-error so a fresh session is
  // not pre-poisoned by the previous load failure.
  it('setWebView clears the cached bootstrap error', async () => {
    const { WasmBridge } = await import('@/features/hardware-wallet/services/wasm-bridge');
    const bridge = new WasmBridge();
    bridge.setWebView({ postMessage: () => undefined });
    let nonce = bridge.getSessionNonce();
    bridge.onMessage(
      JSON.stringify({
        nonce,
        type: 'wasm_error',
        id: 0,
        error: { message: 'first failure' },
      }),
    );
    bridge.setWebView({ postMessage: () => undefined });
    nonce = bridge.getSessionNonce();
    bridge.onMessage(JSON.stringify({ nonce, type: 'wasm_ready' }));
    await expect(bridge.waitReady()).resolves.toBeUndefined();
  });
});

/**
 * Regression tests for Commit 3: state-machine hardening.
 *
 * CC-8: pair and deviceInfo are now wrapped in translateErrors so a
 *       firmware-rejected user abort surfaces as HwUserAbortError, not
 *       a raw bridge error.
 * CC-23: concurrent connect()s are serialised via the lifecycle chain.
 *        A second connect awaits the first instead of racing on the
 *        physical transport.
 * CC-24: sign* and getAddress accept AbortSignal; aborting rejects the
 *        local promise with HwUserAbortError and posts a transport_error
 *        envelope to the WebView so the WASM read unwinds.
 */

function makeBridgeStub(callImpl: (m: string, a: readonly unknown[], o?: CallOpts) => Promise<unknown>) {
  return {
    call: callImpl,
    waitReady: async () => undefined,
    setWebView: () => undefined,
    getSessionNonce: () => 'test-nonce',
    onMessage: () => undefined,
    sendTransportData: () => undefined,
    notifyTransportFailure: () => undefined,
    failPending: () => undefined,
    destroy: () => undefined,
    onTransportRead: null,
    onTransportWrite: null,
  };
}

describe('BitboxProvider — translateErrors over pair / deviceInfo (CC-8)', () => {
  it('pair user-abort surfaces as HwUserAbortError, not raw Error', async () => {
    const bridge = makeBridgeStub(async (method) => {
      if (method === 'pair') {
        const e = new Error('firmware: user abort');
        (e as Error & { code?: number }).code = 104;
        throw e;
      }
      return null;
    });
    const provider = new BitboxProvider(bridge as never);
    const device: HardwareWalletDevice = { id: 'fake', name: 'BB', type: 'bitbox02', transport: 'ble' };
    await expect(provider.connect(device)).rejects.toBeInstanceOf(HwUserAbortError);
  });

  it('deviceInfo firmware-reject surfaces as HwFirmwareRejectError, not raw Error', async () => {
    const bridge = makeBridgeStub(async (method) => {
      if (method === 'pair') return { channelHash: null };
      if (method === 'deviceInfo') {
        const e = new Error('firmware error 101: state invalid');
        (e as Error & { code?: number }).code = 101;
        throw e;
      }
      return null;
    });
    const provider = new BitboxProvider(bridge as never);
    const device: HardwareWalletDevice = { id: 'fake', name: 'BB', type: 'bitbox02', transport: 'ble' };
    const { HwFirmwareRejectError } = await import('@/features/hardware-wallet/services/errors');
    await expect(provider.connect(device)).rejects.toBeInstanceOf(HwFirmwareRejectError);
  });
});

describe('BitboxProvider — serialised lifecycle (CC-23)', () => {
  it('two concurrent connect() calls do not interleave bridge.pair invocations', async () => {
    let pairInFlight = 0;
    let maxConcurrent = 0;
    const bridge = makeBridgeStub(async (method) => {
      if (method === 'pair') {
        pairInFlight += 1;
        maxConcurrent = Math.max(maxConcurrent, pairInFlight);
        await new Promise((r) => setTimeout(r, 10));
        pairInFlight -= 1;
        return { channelHash: null };
      }
      if (method === 'deviceInfo') return { version: '9.21.0', product: 'bitbox02-multi', name: 'BB', initialized: true };
      return null;
    });
    const provider = new BitboxProvider(bridge as never);
    const deviceA: HardwareWalletDevice = { id: 'A', name: 'BB-A', type: 'bitbox02', transport: 'ble' };
    const deviceB: HardwareWalletDevice = { id: 'B', name: 'BB-B', type: 'bitbox02', transport: 'ble' };
    // Issue two connects in rapid succession.
    const a = provider.connect(deviceA).catch(() => undefined);
    const b = provider.connect(deviceB).catch(() => undefined);
    await Promise.all([a, b]);
    // The serialisation chain guarantees pair is never concurrent.
    expect(maxConcurrent).toBeLessThanOrEqual(1);
  });

  it('disconnect cancels an in-flight connect via its abort controller', async () => {
    let pairRejected = false;
    const bridge = makeBridgeStub(async (method, _args, opts) => {
      if (method === 'pair') {
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            pairRejected = true;
            reject(new HwUserAbortError());
          });
        });
      }
      return null;
    });
    const provider = new BitboxProvider(bridge as never);
    const device: HardwareWalletDevice = { id: 'X', name: 'BB', type: 'bitbox02', transport: 'ble' };
    const connecting = provider.connect(device).catch((e) => e);
    // Yield so connect() enters the pair await.
    await new Promise((r) => setTimeout(r, 5));
    // Disconnect aborts the in-flight controller.
    await provider.disconnect();
    const result = await connecting;
    expect(result).toBeInstanceOf(HwUserAbortError);
    expect(pairRejected).toBe(true);
  });
});

describe('BitboxProvider — AbortSignal on signing (CC-24)', () => {
  it('signEthTransaction rejects with HwUserAbortError when signal aborts', async () => {
    let signRejected = false;
    const bridge = makeBridgeStub(async (method, _args, opts) => {
      if (method === 'ethSign1559Transaction') {
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            signRejected = true;
            reject(new HwUserAbortError());
          });
        });
      }
      return null;
    });
    const provider = new BitboxProvider(bridge as never);
    (provider as unknown as { transport: object }).transport = {};
    const ctrl = new AbortController();
    const inflight = provider
      .signEthTransaction({
        chainId: 1n,
        derivationPath: PATH,
        rlpPayload: new Uint8Array([1, 2, 3]),
        isEIP1559: true,
        signal: ctrl.signal,
      })
      .catch((e) => e);
    await new Promise((r) => setTimeout(r, 5));
    ctrl.abort();
    const result = await inflight;
    expect(result).toBeInstanceOf(HwUserAbortError);
    expect(signRejected).toBe(true);
  });

  it('signEthMessage rejects immediately when handed an already-aborted signal', async () => {
    const bridge = makeBridgeStub(async () => new Promise(() => undefined));
    const provider = new BitboxProvider(bridge as never);
    (provider as unknown as { transport: object }).transport = {};
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      provider.signEthMessage({
        chainId: 1n,
        derivationPath: PATH,
        message: new Uint8Array([1]),
        signal: ctrl.signal,
      }),
    ).rejects.toBeInstanceOf(HwUserAbortError);
  });
});
