export type HardwareWalletType = 'bitbox02' | 'bitbox02-nova';

export type TransportType = 'usb' | 'ble';

export type HardwareWalletDevice = {
  id: string;
  name: string;
  type: HardwareWalletType;
  transport: TransportType;
};

export type HardwareWalletStatus =
  | 'disconnected'
  | 'scanning'
  | 'detected'
  | 'connecting'
  | 'verifying'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Distinct error classes surfaced from HardwareWalletProvider. The consumer
 * UI MUST distinguish at least UserAbort and FirmwareReject from generic
 * errors — they need different copy ("You rejected on device" vs
 * "Connection failed"). See bitbox-testkit quirk catalogue for the firmware
 * codes mapped here.
 */
export type HardwareWalletError =
  | { kind: 'NotConnected' }
  | { kind: 'TransportFailure'; cause: string }
  | { kind: 'PermissionDenied'; platform: 'android' | 'ios' | 'unknown' }
  | { kind: 'BridgeNotReady' }
  | { kind: 'BridgeTimeout'; method: string; timeoutMs: number }
  | { kind: 'UserAbort' }
  | { kind: 'FirmwareReject'; code: number; message: string }
  | { kind: 'FirmwareTooOld'; minRequired: string; actual: string }
  | { kind: 'FirmwareUnsupportedOperation'; operation: string; firmware: string }
  | { kind: 'AddressMismatch' }
  | { kind: 'InvalidPayload'; reason: string }
  | { kind: 'Unknown'; cause: string };

/**
 * Brand for the "I accept that this call does NOT show the value on the
 * BitBox display" escape hatch. Disabling the device-display step removes
 * the trusted-display verification (BitBox's primary defence against a
 * malicious host) — callers MUST acknowledge in code at the call site so
 * code review can spot the unsafe path.
 *
 * Type-only — there is no runtime value. The branded shape forces every
 * call site to construct the object inline (literal type), making greppable.
 */
export type NoDisplayAck = {
  readonly acknowledgeNoDisplay: 'I_ACCEPT_THE_RISK_OF_NOT_DISPLAYING_ON_DEVICE';
  /** Free-text reason. Logged at warn level. */
  readonly reason: string;
};

/**
 * displayOnDevice variants. The safe default (omit / `true`) shows the
 * value on the device. The opt-out branch requires the branded type
 * audit-skip-line
 * above — the literal boolean opt-out (displayOnDevice: false) is gone.
 */
export type DeviceDisplay = true | NoDisplayAck;

/**
 * Common options every device-display API takes. Defaults are SAFE: any
 * call that omits `displayOnDevice` defaults to true — the BitBox screen
 * shows the value, the user verifies it on a second channel. To opt out,
 * pass `{ acknowledgeNoDisplay: 'I_ACCEPT_THE_RISK_OF_NOT_DISPLAYING_ON_DEVICE',
 * reason: 'why' }` and accept that the operation has no on-device verify.
 * audit-skip-line
 */
export type DeviceDisplayOpts = {
  /** See DeviceDisplay. Default: true (verify on device). */
  displayOnDevice?: DeviceDisplay;
};

/** Common cancellation field. Aborting cancels the in-flight call; the
 *  device may still be showing its prompt and must be dismissed there. */
export type CancellableOpts = {
  signal?: AbortSignal;
};

export type EthAddressOpts = DeviceDisplayOpts &
  CancellableOpts & {
    /** EVM chain ID. NEVER hardcode; the BitBox displays this on-device. */
    chainId: bigint;
    derivationPath?: string;
    /**
     * If true, the provider independently re-derives the address from
     * the device's ethXpub and throws HwAddressMismatchError on
     * disagreement. This is the trusted-display verification path —
     * use it whenever the result is persisted or shown to the user.
     * Defaults to false (off) to keep the original API surface.
     */
    verifyByXpub?: boolean;
  };

export type BtcAddressOpts = DeviceDisplayOpts &
  CancellableOpts & {
    /** Bitcoin coin/network: btc, tbtc (testnet), rbtc (regtest), ltc. */
    coin: 'btc' | 'tbtc' | 'rbtc' | 'ltc';
    /** Script config: 'p2wpkh' (default), 'p2wpkh-p2sh', 'p2pkh', 'p2tr'. */
    scriptType?: 'p2wpkh' | 'p2wpkh-p2sh' | 'p2pkh' | 'p2tr';
    derivationPath?: string;
  };

export type EthSignTxOpts = CancellableOpts & {
  chainId: bigint;
  derivationPath: string;
  /** RLP-encoded legacy or EIP-1559 transaction payload. */
  rlpPayload: Uint8Array;
  isEIP1559: boolean;
  /** Per-call timeout. Sign flows may legitimately take > 30s while the
   *  user reads on-device. Default: 120_000 ms. */
  timeoutMs?: number;
};

export type EthSignMessageOpts = CancellableOpts & {
  chainId: bigint;
  derivationPath: string;
  message: Uint8Array;
  timeoutMs?: number;
};

export type ConnectOpts = CancellableOpts;
export type DisconnectOpts = CancellableOpts;

export type DeviceInfo = {
  /** Device version string, e.g. "9.21.0". */
  version: string;
  /** Device product, e.g. "bitbox02-multi", "bitbox02-btconly". */
  product: string;
  /** Device name set by the user. */
  name: string;
  /** Whether the device is initialised (has a seed). */
  initialized: boolean;
};

/**
 * Listener fired by HardwareWalletProvider when the transport unexpectedly
 * goes away (cable pulled, BLE disconnect, OS sleep). UI must transition
 * to a "reconnecting" / "reconnect" state — not stay in the previous
 * busy spinner.
 */
export type TransportEventListener = (event: 'disconnected' | 'reconnected' | 'fatal') => void;

export interface HardwareWalletProvider {
  /** Scan for devices via USB or BLE. */
  scanDevices(): Promise<HardwareWalletDevice[]>;

  /**
   * Establish connection and verify secure channel (Noise XX handshake).
   * Concurrent calls are serialised — a second `connect` awaits the first
   * before opening its own transport. Pass `opts.signal` to abort an
   * in-flight connect (e.g. on screen unmount).
   */
  connect(device: HardwareWalletDevice, opts?: ConnectOpts): Promise<void>;

  /** Disconnect from device. Errors are surfaced, not swallowed. */
  disconnect(opts?: DisconnectOpts): Promise<void>;

  /** Return cached device info (populated during connect). null before connect. */
  getDeviceInfo(): DeviceInfo | null;

  /**
   * Return the pairing channel hash from the last successful connect,
   * hex-encoded, or null before pairing. The UI MUST surface this and
   * require the user to visually compare it against the value on the
   * BitBox display. Without that comparison the Noise XX pairing's
   * man-in-the-middle resistance is unrealised.
   */
  getChannelHash(): string | null;

  /** Subscribe to transport-level disconnect / reconnect events. */
  subscribeTransport(listener: TransportEventListener): () => void;

  /** Get ETH address at derivation path. displayOnDevice defaults to TRUE. */
  getEthAddress(opts: EthAddressOpts): Promise<string>;

  /** Get BTC-family address. displayOnDevice defaults to TRUE. */
  getBtcAddress(opts: BtcAddressOpts): Promise<string>;

  /** Sign a legacy or EIP-1559 transaction. Timeout defaults to 120s. */
  signEthTransaction(opts: EthSignTxOpts): Promise<{ r: string; s: string; v: number }>;

  /** Sign a personal message. Timeout defaults to 120s. */
  signEthMessage(opts: EthSignMessageOpts): Promise<Uint8Array>;
}

export interface BitboxTransport {
  write(data: Uint8Array): Promise<number>;
  read(): Promise<Uint8Array>;
  close(): Promise<void>;
}

export const DEFAULT_ETH_DERIVATION_PATH = "m/44'/60'/0'/0/0";
export const DEFAULT_BTC_DERIVATION_PATH = "m/84'/0'/0'/0/0";

/** Minimum firmware version that supports all currently-listed operations. */
export const MIN_FIRMWARE_VERSION = '9.19.0';
