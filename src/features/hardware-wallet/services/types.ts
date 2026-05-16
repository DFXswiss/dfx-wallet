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
  | { kind: 'Unknown'; cause: string };

/**
 * Common options every device-display API takes. The defaults are SAFE: any
 * call that omits `displayOnDevice` defaults to TRUE — the BitBox screen
 * shows the value, the user verifies it on a second channel. Setting
 * `displayOnDevice: false` is explicitly opt-out and should be flagged in
 * review (see audit-runner quirk E3).
 */
export type DeviceDisplayOpts = {
  /** Show the value on the BitBox screen so the user can verify it. Default: true. */
  displayOnDevice?: boolean;
};

export type EthAddressOpts = DeviceDisplayOpts & {
  /** EVM chain ID. NEVER hardcode; the BitBox displays this on-device. */
  chainId: bigint;
  derivationPath?: string;
};

export type BtcAddressOpts = DeviceDisplayOpts & {
  /** Bitcoin coin/network: btc, tbtc (testnet), rbtc (regtest), ltc. */
  coin: 'btc' | 'tbtc' | 'rbtc' | 'ltc';
  /** Script config: 'p2wpkh' (default), 'p2wpkh-p2sh', 'p2pkh', 'p2tr'. */
  scriptType?: 'p2wpkh' | 'p2wpkh-p2sh' | 'p2pkh' | 'p2tr';
  derivationPath?: string;
};

export type EthSignTxOpts = {
  chainId: bigint;
  derivationPath: string;
  /** RLP-encoded legacy or EIP-1559 transaction payload. */
  rlpPayload: Uint8Array;
  isEIP1559: boolean;
  /** Per-call timeout. Sign flows may legitimately take > 30s while the
   *  user reads on-device. Default: 120_000 ms. */
  timeoutMs?: number;
};

export type EthSignMessageOpts = {
  chainId: bigint;
  derivationPath: string;
  message: Uint8Array;
  timeoutMs?: number;
};

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

  /** Establish connection and verify secure channel (Noise XX handshake). */
  connect(device: HardwareWalletDevice): Promise<void>;

  /** Disconnect from device. Errors are surfaced, not swallowed. */
  disconnect(): Promise<void>;

  /** Return cached device info (populated during connect). null before connect. */
  getDeviceInfo(): DeviceInfo | null;

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
