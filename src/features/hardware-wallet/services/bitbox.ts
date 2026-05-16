import { Platform } from 'react-native';
import type {
  BitboxTransport,
  BtcAddressOpts,
  ConnectOpts,
  DeviceInfo,
  DisconnectOpts,
  EthAddressOpts,
  EthSignMessageOpts,
  EthSignTxOpts,
  HardwareWalletDevice,
  HardwareWalletProvider,
  TransportEventListener,
} from './types';
import {
  DEFAULT_BTC_DERIVATION_PATH,
  DEFAULT_ETH_DERIVATION_PATH,
  MIN_FIRMWARE_VERSION,
} from './types';
import { scanUsbDevices, UsbTransport } from './transport-usb';
import { BleTransport, scanBleDevices } from './transport-ble';
import { WasmBridge, type WebViewRef } from './wasm-bridge';
import { ethSignatureToHex } from './bitbox-protocol';
import { assertChainIdMatchesRlp } from './eth-tx-validation';
import { verifyEthAddressByXpub } from './eth-address-verify';
import {
  compareVersions,
  HwAddressMismatchError,
  HwFirmwareRejectError,
  HwFirmwareTooOldError,
  HwFirmwareUnsupportedOperationError,
  HwInvalidPayloadError,
  HwNotConnectedError,
  HwTransportFailureError,
  HwUserAbortError,
  isUserAbort,
  parseFirmwareError,
} from './errors';
import { logHw } from './log';

/**
 * BitBox02 hardware wallet provider.
 *
 * Architecture:
 *
 *   USB/BLE Transport ─→ WasmBridge ─→ WebView (bitbox-api WASM) ─→ Device
 *
 * Lifecycle is per-instance: callers should NEVER create a module-level
 * singleton. Use the React hook at /src/features/hardware-wallet/store.ts
 * or instantiate one per screen and let useEffect cleanup own the
 * disconnect call.
 *
 * Safety invariants this class enforces:
 *
 *   1. Every device-display call passes `display: true` by default. The
 *      caller must explicitly opt-out and review the call site (the
 *      audit-runner has a static check for this pattern).
 *   2. chainId / coin is plumbed from the caller — never hardcoded.
 *   3. Errors are classified into typed exceptions so the UI can branch
 *      on user-abort vs. firmware-reject vs. transport-failure.
 *   4. Firmware version is captured during connect and gated against
 *      MIN_FIRMWARE_VERSION before any signing operation.
 *   5. Transport disconnects emit events to subscribers, so the UI can
 *      transition state instead of waiting on a pending promise that
 *      will time out 30 s later.
 */
export class BitboxProvider implements HardwareWalletProvider {
  private transport: BitboxTransport | null = null;
  private connectedDevice: HardwareWalletDevice | null = null;
  private bridge: WasmBridge;
  private deviceInfo: DeviceInfo | null = null;
  private listeners = new Set<TransportEventListener>();
  /** Per-instance flow id; included in every emitted log line. Used by
   *  log aggregators to stitch a flow back together. */
  private readonly flowId: string;
  /**
   * Serialisation chain for connect/disconnect/attemptReconnect. The
   * physical transport (USB native module, BLE singleton manager) is a
   * process-global resource; even with a per-screen provider, two
   * overlapping connect calls would race on it. Chaining via this
   * promise means each lifecycle operation waits for the previous one
   * before mutating provider state.
   */
  private lifecycleChain: Promise<void> = Promise.resolve();
  /**
   * When set, an in-flight connect() can be aborted by calling
   * disconnect() — the disconnect tears down the chain and the
   * connect's per-await abort check throws.
   */
  private currentConnectAbort: AbortController | null = null;
  private disposed = false;

  constructor(bridge: WasmBridge = new WasmBridge()) {
    this.bridge = bridge;
    this.flowId = generateFlowId();
  }

  /** Attach a WebView ref so the bridge can post messages into it. */
  setWebView(ref: WebViewRef): void {
    this.bridge.setWebView(ref);
  }

  /** Forward bridge incoming messages from the WebView. */
  onBridgeMessage(data: string): void {
    this.bridge.onMessage(data);
  }

  getBridge(): WasmBridge {
    return this.bridge;
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  subscribeTransport(listener: TransportEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: 'disconnected' | 'reconnected' | 'fatal'): void {
    logHw(event === 'fatal' ? 'error' : 'warn', `transport_event.${event}`, undefined, this.flowId);
    for (const l of [...this.listeners]) {
      try {
        l(event);
      } catch {
        // Listener errors must not affect transport state.
      }
    }
  }

  async scanDevices(): Promise<HardwareWalletDevice[]> {
    const results = await Promise.allSettled([scanUsbDevices(), scanBleDevices()]);
    const devices: HardwareWalletDevice[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') devices.push(...result.value);
    }
    return devices;
  }

  /**
   * Open a transport, pair the device, and verify firmware.
   *
   * Concurrent calls are serialised by chaining onto `lifecycleChain` —
   * a second `connect` awaits the first cleanly. If the caller passes
   * `opts.signal`, aborting will propagate into each individual bridge
   * call and into a pre-await re-check, so a user who navigates away
   * does not have to wait 60s for the pair timeout.
   */
  async connect(device: HardwareWalletDevice, opts: ConnectOpts = {}): Promise<void> {
    return this.runSerialised(() => this.doConnect(device, opts), 'connect');
  }

  private async doConnect(device: HardwareWalletDevice, opts: ConnectOpts): Promise<void> {
    if (this.disposed) throw new HwTransportFailureError('provider disposed');
    logHw('info', 'connect.start', { transport: device.transport, type: device.type }, this.flowId);
    if (device.transport === 'usb' && Platform.OS !== 'android') {
      throw new HwTransportFailureError('USB connection is only available on Android');
    }

    // Set up the abort controller this attempt is bound to. Disconnect()
    // can abort it via cancelInFlightConnect(). The caller's signal feeds
    // the same controller.
    const controller = new AbortController();
    this.currentConnectAbort = controller;
    const onCallerAbort = () => controller.abort();
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', onCallerAbort, { once: true });
    }
    const signal = controller.signal;
    const checkAbort = () => {
      if (signal.aborted) throw new HwUserAbortError();
    };

    try {
      // Inline disconnect logic — we are already inside the serialised
      // chain so calling this.disconnect() would deadlock.
      await this.teardownTransport();
      checkAbort();

      // 1. Open physical transport.
      if (device.transport === 'usb') {
        const usb = new UsbTransport();
        await usb.open(device.id);
        this.transport = usb;
      } else {
        const ble = new BleTransport();
        await ble.connectToDevice(device.id);
        this.transport = ble;
      }
      checkAbort();

      // 2. Wire transport read/write into the bridge.
      this.bridge.onTransportWrite = async (data: Uint8Array) => {
        try {
          if (this.transport) await this.transport.write(data);
        } catch (err) {
          // Tell the WebView so the in-flight WASM read rejects fast
          // rather than waiting for the 120s sign-call timeout.
          this.bridge.notifyTransportFailure('transport write failed');
          this.emit('fatal');
          throw err;
        }
      };
      this.bridge.onTransportRead = async () => {
        try {
          if (this.transport) {
            const data = await this.transport.read();
            this.bridge.sendTransportData(data);
          }
        } catch {
          // Read failures (timeout, transport gone) — push transport-error
          // into the WebView so the pending sign call rejects deterministi-
          // cally, AND notify subscribers so the UI can transition.
          this.bridge.notifyTransportFailure('transport read failed');
          this.emit('disconnected');
        }
      };

      // 3. Wait for the WebView WASM to be loaded.
      await this.bridge.waitReady();
      checkAbort();

      // 4. Initiate pairing — wrapped in translateErrors so a user
      //    rejecting on-device surfaces as a typed HwUserAbortError.
      await this.translateErrors('pair', () =>
        this.bridge.call('pair', [], { timeoutMs: 60_000, signal }),
      );
      checkAbort();

      // 5. Fetch device info — also wrapped so firmware-rejects surface typed.
      this.deviceInfo = await this.translateErrors('deviceInfo', () => this.fetchDeviceInfo(signal));
      checkAbort();
      logHw(
        'info',
        'connect.device_info',
        {
          firmware: this.deviceInfo.version,
          product: this.deviceInfo.product,
          initialized: this.deviceInfo.initialized,
        },
        this.flowId,
      );
      if (compareVersions(this.deviceInfo.version, MIN_FIRMWARE_VERSION) < 0) {
        logHw(
          'error',
          'connect.firmware_too_old',
          { actual: this.deviceInfo.version, minRequired: MIN_FIRMWARE_VERSION },
          this.flowId,
        );
        await this.teardownTransport();
        throw new HwFirmwareTooOldError(MIN_FIRMWARE_VERSION, this.deviceInfo.version);
      }

      this.connectedDevice = device;
      logHw('info', 'connect.success', undefined, this.flowId);
    } catch (err) {
      // Tidy up partial state. If we threw mid-connect, the transport
      // may be open but unpaired; close it before re-throwing.
      await this.teardownTransport().catch(() => undefined);
      throw err;
    } finally {
      if (opts.signal) opts.signal.removeEventListener('abort', onCallerAbort);
      if (this.currentConnectAbort === controller) this.currentConnectAbort = null;
    }
  }

  async disconnect(opts: DisconnectOpts = {}): Promise<void> {
    // Abort any concurrent in-flight connect so it short-circuits at its
    // next await instead of fighting us for the transport.
    this.currentConnectAbort?.abort();
    return this.runSerialised(() => this.doDisconnect(opts), 'disconnect');
  }

  private async doDisconnect(_opts: DisconnectOpts): Promise<void> {
    await this.teardownTransport();
    this.connectedDevice = null;
    this.deviceInfo = null;
  }

  /**
   * Close the physical transport AND tear down the bridge so any pending
   * sign call rejects immediately. Idempotent — safe to call when no
   * transport is open.
   */
  private async teardownTransport(): Promise<void> {
    if (this.transport) {
      logHw('debug', 'disconnect.start', undefined, this.flowId);
      try {
        await this.bridge.call('close', [], { timeoutMs: 2_000 });
      } catch (err) {
        logHw('warn', 'disconnect.bridge_close_failed', { err: errorContext(err) }, this.flowId);
      }
      try {
        await this.transport.close();
      } catch (err) {
        logHw('warn', 'disconnect.transport_close_failed', { err: errorContext(err) }, this.flowId);
      }
      this.transport = null;
      logHw('debug', 'disconnect.complete', undefined, this.flowId);
    }
    // Drain any pending bridge calls — they cannot succeed without a
    // transport — and clear callbacks so the next connect() can re-wire.
    this.bridge.failPending(new HwTransportFailureError('transport closed'));
    this.bridge.onTransportWrite = null;
    this.bridge.onTransportRead = null;
  }

  /**
   * Serialise a lifecycle operation onto the in-flight chain. Any error
   * is propagated to the caller but does NOT poison the chain — the
   * next operation runs regardless.
   */
  private runSerialised<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const prev = this.lifecycleChain;
    let resolveResult: (v: T) => void;
    let rejectResult: (e: unknown) => void;
    const resultPromise = new Promise<T>((res, rej) => {
      resolveResult = res;
      rejectResult = rej;
    });
    this.lifecycleChain = prev
      .catch(() => undefined)
      .then(async () => {
        try {
          const v = await fn();
          resolveResult(v);
        } catch (e) {
          logHw(
            'debug',
            `lifecycle.${label}.failed`,
            { err: errorContext(e) },
            this.flowId,
          );
          rejectResult(e);
        }
      });
    return resultPromise;
  }

  /**
   * Attempt to re-establish a transport to the last-connected device.
   *
   * Backoff schedule: 500 ms, 1 s, 2 s, 4 s, 8 s (5 attempts, ~15s total).
   * Each attempt:
   *   - opens a fresh transport
   *   - resets the bridge session
   *   - waits for WASM ready
   *   - re-pairs (the channel hash will differ — pairing UI must show this)
   *   - emits 'reconnected' on success or 'fatal' if all attempts fail
   *
   * `signal` cancels the reconnect (e.g. the user navigates away). The
   * promise rejects with HwTransportFailureError on cancellation.
   */
  async attemptReconnect(opts: { signal?: AbortSignal; maxAttempts?: number } = {}): Promise<void> {
    const maxAttempts = opts.maxAttempts ?? 5;
    const device = this.connectedDevice;
    if (!device) {
      throw new HwNotConnectedError();
    }
    const signal = opts.signal;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) {
        throw new HwTransportFailureError('reconnect cancelled');
      }
      try {
        await this.disconnect();
        const connectOpts: ConnectOpts = signal !== undefined ? { signal } : {};
        await this.connect(device, connectOpts);
        this.emit('reconnected');
        return;
      } catch (err) {
        if (signal?.aborted) {
          throw new HwTransportFailureError('reconnect cancelled');
        }
        if (attempt === maxAttempts) {
          this.emit('fatal');
          throw err;
        }
        // Exponential backoff with a cap, interruptible by signal.
        const delay = Math.min(500 * 2 ** (attempt - 1), 8_000);
        await sleepInterruptible(delay, signal);
      }
    }
  }

  async getEthAddress(opts: EthAddressOpts): Promise<string> {
    this.ensureConnected();
    if (opts.signal?.aborted) throw new HwUserAbortError();
    const displayOnDevice = this.resolveDisplayOnDevice('getEthAddress', opts.displayOnDevice);
    const bridgeOpts: { timeoutMs: number; signal?: AbortSignal } = { timeoutMs: 60_000 };
    if (opts.signal !== undefined) bridgeOpts.signal = opts.signal;
    const derivationPath = opts.derivationPath ?? DEFAULT_ETH_DERIVATION_PATH;
    const deviceAddress = await this.translateErrors('getEthAddress', () =>
      this.bridge.call<string>(
        'ethAddress',
        [String(opts.chainId), derivationPath, displayOnDevice],
        bridgeOpts,
      ),
    );
    if (opts.verifyByXpub === true) {
      return this.translateErrors('verifyEthAddress', () =>
        verifyEthAddressByXpub({
          derivationPath,
          deviceReturnedAddress: deviceAddress,
          fetchXpub: (parentPath) =>
            this.bridge.call<string>('ethXpub', [parentPath], { timeoutMs: 30_000 }),
        }),
      );
    }
    return deviceAddress;
  }

  async getBtcAddress(opts: BtcAddressOpts): Promise<string> {
    this.ensureConnected();
    if (opts.signal?.aborted) throw new HwUserAbortError();
    const displayOnDevice = this.resolveDisplayOnDevice('getBtcAddress', opts.displayOnDevice);
    const bridgeOpts: { timeoutMs: number; signal?: AbortSignal } = { timeoutMs: 60_000 };
    if (opts.signal !== undefined) bridgeOpts.signal = opts.signal;
    return this.translateErrors('getBtcAddress', () =>
      this.bridge.call<string>(
        'btcAddress',
        [
          opts.coin,
          opts.derivationPath ?? DEFAULT_BTC_DERIVATION_PATH,
          { simpleType: opts.scriptType ?? 'p2wpkh' },
          displayOnDevice,
        ],
        bridgeOpts,
      ),
    );
  }

  async signEthTransaction(opts: EthSignTxOpts): Promise<{ r: string; s: string; v: number }> {
    this.ensureConnected();
    if (opts.signal?.aborted) throw new HwUserAbortError();
    // CC-6: parse the RLP and assert that the chainId committed inside
    // the body matches the chainId we're about to pass to the SDK. A
    // mismatch is a chain-replay attack signal — refuse to bridge.
    assertChainIdMatchesRlp(opts.rlpPayload, opts.chainId, opts.isEIP1559);
    const method = opts.isEIP1559 ? 'ethSign1559Transaction' : 'ethSignTransaction';
    const bridgeOpts: { timeoutMs: number; signal?: AbortSignal } = {
      timeoutMs: opts.timeoutMs ?? 120_000,
    };
    if (opts.signal !== undefined) bridgeOpts.signal = opts.signal;
    const sig = await this.translateErrors(method, () =>
      this.bridge.call<{ r: number[]; s: number[]; v: number[] }>(
        method,
        [String(opts.chainId), opts.derivationPath, Array.from(opts.rlpPayload)],
        bridgeOpts,
      ),
    );
    return ethSignatureToHex({
      r: new Uint8Array(sig.r),
      s: new Uint8Array(sig.s),
      v: new Uint8Array(sig.v),
    });
  }

  async signEthMessage(opts: EthSignMessageOpts): Promise<Uint8Array> {
    this.ensureConnected();
    if (opts.signal?.aborted) throw new HwUserAbortError();
    const bridgeOpts: { timeoutMs: number; signal?: AbortSignal } = {
      timeoutMs: opts.timeoutMs ?? 120_000,
    };
    if (opts.signal !== undefined) bridgeOpts.signal = opts.signal;
    const sig = await this.translateErrors('ethSignMessage', () =>
      this.bridge.call<{ r: number[]; s: number[]; v: number[] }>(
        'ethSignMessage',
        [String(opts.chainId), opts.derivationPath, Array.from(opts.message)],
        bridgeOpts,
      ),
    );
    // v is variable length (1+ bytes for chainId > 110 on EIP-155). The
    // hex-encoding helper preserves the full big-endian magnitude.
    const result = new Uint8Array(64 + sig.v.length);
    result.set(new Uint8Array(sig.r), 0);
    result.set(new Uint8Array(sig.s), 32);
    result.set(new Uint8Array(sig.v), 64);
    return result;
  }

  private ensureConnected(): void {
    if (!this.transport) throw new HwNotConnectedError();
  }

  /**
   * Map raw bridge errors onto typed Hw* error classes. UserAbort and
   * firmware-reject are classified first; everything else passes through.
   * Every translated error emits a structured log so production triage
   * can see which class of error is most common.
   */
  private async translateErrors<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      logHw('debug', `op.${operation}.success`, undefined, this.flowId);
      return result;
    } catch (err) {
      if (isUserAbort(err)) {
        logHw('info', `op.${operation}.user_abort`, undefined, this.flowId);
        throw new HwUserAbortError();
      }
      const fw = parseFirmwareError(err);
      if (fw) {
        logHw(
          'warn',
          `op.${operation}.firmware_reject`,
          { code: fw.code, message: fw.message },
          this.flowId,
        );
        throw fw;
      }
      logHw('error', `op.${operation}.failed`, { err: errorContext(err) }, this.flowId);
      throw err;
    }
  }

  /**
   * Resolve the branded DeviceDisplay opt into the boolean the bridge
   * dispatcher expects. The branded type forces the call site to be
   * greppable — `displayOnDevice: false` is no longer a valid value.
   * The opt-out branch carries a written reason which we log at warn
   * level so production triage can see who turned the gate off and why.
   */
  private resolveDisplayOnDevice(
    operation: string,
    display: import('./types').DeviceDisplay | undefined,
  ): boolean {
    if (display === undefined || display === true) return true;
    logHw(
      'warn',
      `op.${operation}.display_on_device_off`,
      { reason: display.reason },
      this.flowId,
    );
    return false;
  }

  private async fetchDeviceInfo(signal?: AbortSignal): Promise<DeviceInfo> {
    const opts: { timeoutMs: number; signal?: AbortSignal } = { timeoutMs: 10_000 };
    if (signal !== undefined) opts.signal = signal;
    const raw = await this.bridge.call<DeviceInfo>('deviceInfo', [], opts);
    return raw;
  }
}

/**
 * Compile-time assertion that BitboxProvider implements the full provider
 * surface. Forces a build break if the interface drifts ahead. Pure
 * type-level — no runtime instantiation, so importing this module does
 * not allocate a WasmBridge or a flowId.
 */
type _ProviderImplCheck =
  BitboxProvider extends HardwareWalletProvider ? true : never;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _providerImplCheck: _ProviderImplCheck = true;

// Re-export so consumers can construct one without reaching into types.
export type { HardwareWalletProvider } from './types';
export {
  HwUserAbortError,
  HwFirmwareRejectError,
  HwFirmwareTooOldError,
  HwFirmwareUnsupportedOperationError,
  HwNotConnectedError,
  HwAddressMismatchError,
} from './errors';

/**
 * Per-provider flow ID: 12 hex chars, regenerated on every constructor.
 * Used as the correlation id in every logHw call so a log-aggregator can
 * reconstruct a complete connect → sign → disconnect flow without
 * stitching by wall-clock guessing.
 */
function generateFlowId(): string {
  const buf = new Uint8Array(6);
  const g = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => void } }).crypto;
  if (g?.getRandomValues) {
    g.getRandomValues(buf);
  } else {
    // eslint-disable-next-line security/detect-object-injection -- i is bounded by buf.length above
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Squeeze an unknown thrown value into a redaction-friendly shape for the
 * logger. The logger will further strip sensitive substrings.
 */
function errorContext(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { name: 'Unknown', message: String(err) };
}

/**
 * Sleep that can be cancelled by an AbortSignal. Resolves on timeout or
 * on signal abort; throws if signal was already aborted on entry.
 */
/**
 * Sleep for `ms`, rejecting with HwTransportFailureError if `signal`
 * aborts. Both the pre-call check and the in-flight abort REJECT —
 * previously the abort-during-sleep path resolved silently, which let
 * the reconnect loop bury cancellation under a fresh attempt.
 */
function sleepInterruptible(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new HwTransportFailureError('aborted'));
  }
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      if (onAbort && signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new HwTransportFailureError('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
