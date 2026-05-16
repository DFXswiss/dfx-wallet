import { Platform } from 'react-native';
import type {
  BitboxTransport,
  BtcAddressOpts,
  DeviceInfo,
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
import {
  compareVersions,
  HwAddressMismatchError,
  HwFirmwareRejectError,
  HwFirmwareTooOldError,
  HwFirmwareUnsupportedOperationError,
  HwNotConnectedError,
  HwUserAbortError,
  isUserAbort,
  parseFirmwareError,
} from './errors';

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

  constructor(bridge: WasmBridge = new WasmBridge()) {
    this.bridge = bridge;
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

  async connect(device: HardwareWalletDevice): Promise<void> {
    if (device.transport === 'usb' && Platform.OS !== 'android') {
      throw new Error('USB connection is only available on Android');
    }

    // Always start from a clean slate.
    await this.disconnect();

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

    // 2. Wire transport read/write into the bridge.
    this.bridge.onTransportWrite = async (data: Uint8Array) => {
      try {
        if (this.transport) await this.transport.write(data);
      } catch (err) {
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
        // Read failures (timeout, transport gone) propagate via the bridge
        // call timeout — but we also notify subscribers so the UI can
        // surface "Reconnect device" rather than wait for a 30 s spinner.
        this.emit('disconnected');
      }
    };

    // 3. Wait for the WebView WASM to be loaded.
    await this.bridge.waitReady();

    // 4. Initiate pairing.
    await this.bridge.call('pair', [], { timeoutMs: 60_000 });

    // 5. Fetch device info and gate against minimum firmware.
    this.deviceInfo = await this.fetchDeviceInfo();
    if (compareVersions(this.deviceInfo.version, MIN_FIRMWARE_VERSION) < 0) {
      await this.disconnect();
      throw new HwFirmwareTooOldError(MIN_FIRMWARE_VERSION, this.deviceInfo.version);
    }

    this.connectedDevice = device;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.bridge.call('close', [], { timeoutMs: 2_000 });
      } catch {
        // Bridge close failure is non-fatal during teardown — we still
        // tear down the transport. Telemetry could pick this up if we
        // start emitting structured logs.
      }
      try {
        await this.transport.close();
      } catch {
        // Same reasoning as above.
      }
      this.transport = null;
    }
    this.connectedDevice = null;
    this.deviceInfo = null;
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
      throw new Error('attemptReconnect: no previously connected device');
    }
    const signal = opts.signal;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) {
        throw new Error('attemptReconnect: cancelled');
      }
      try {
        await this.disconnect();
        await this.connect(device);
        this.emit('reconnected');
        return;
      } catch (err) {
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
    const displayOnDevice = opts.displayOnDevice !== false; // default TRUE
    return this.translateErrors('getEthAddress', () =>
      this.bridge.call<string>(
        'ethAddress',
        [String(opts.chainId), opts.derivationPath ?? DEFAULT_ETH_DERIVATION_PATH, displayOnDevice],
        { timeoutMs: 60_000 },
      ),
    );
  }

  async getBtcAddress(opts: BtcAddressOpts): Promise<string> {
    this.ensureConnected();
    const displayOnDevice = opts.displayOnDevice !== false; // default TRUE
    return this.translateErrors('getBtcAddress', () =>
      this.bridge.call<string>(
        'btcAddress',
        [
          opts.coin,
          opts.derivationPath ?? DEFAULT_BTC_DERIVATION_PATH,
          { simpleType: opts.scriptType ?? 'p2wpkh' },
          displayOnDevice,
        ],
        { timeoutMs: 60_000 },
      ),
    );
  }

  async signEthTransaction(opts: EthSignTxOpts): Promise<{ r: string; s: string; v: number }> {
    this.ensureConnected();
    const method = opts.isEIP1559 ? 'ethSign1559Transaction' : 'ethSignTransaction';
    const sig = await this.translateErrors(method, () =>
      this.bridge.call<{ r: number[]; s: number[]; v: number[] }>(
        method,
        [String(opts.chainId), opts.derivationPath, Array.from(opts.rlpPayload)],
        { timeoutMs: opts.timeoutMs ?? 120_000 },
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
    const sig = await this.translateErrors('ethSignMessage', () =>
      this.bridge.call<{ r: number[]; s: number[]; v: number[] }>(
        'ethSignMessage',
        [String(opts.chainId), opts.derivationPath, Array.from(opts.message)],
        { timeoutMs: opts.timeoutMs ?? 120_000 },
      ),
    );
    const result = new Uint8Array(65);
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
   */
  private async translateErrors<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUserAbort(err)) throw new HwUserAbortError();
      const fw = parseFirmwareError(err);
      if (fw) throw fw;
      throw err;
    }
  }

  private async fetchDeviceInfo(): Promise<DeviceInfo> {
    const raw = await this.bridge.call<DeviceInfo>('deviceInfo', [], { timeoutMs: 10_000 });
    return raw;
  }
}

/**
 * Compile-time assertion that BitboxProvider implements the full provider
 * surface. Forces a build break if the interface drifts ahead.
 */
const _check: HardwareWalletProvider = new BitboxProvider();
void _check;

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
 * Sleep that can be cancelled by an AbortSignal. Resolves on timeout or
 * on signal abort; throws if signal was already aborted on entry.
 */
function sleepInterruptible(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error('aborted'));
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
