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
  | 'pairing'
  | 'connected';

export type HardwareWalletPairing = {
  pairingCode: string | null;
};

export interface HardwareWalletProvider {
  /** Scan for devices via USB or BLE */
  scanDevices(): Promise<HardwareWalletDevice[]>;

  /** Establish connection and verify secure channel (Noise XX handshake) */
  connect(device: HardwareWalletDevice): Promise<void>;

  /** Disconnect from device */
  disconnect(): Promise<void>;

  /** Get ETH address at derivation path */
  getEthAddress(derivationPath?: string): Promise<string>;

  /** Get BTC address at derivation path */
  getBtcAddress(derivationPath?: string): Promise<string>;

  /** Sign an EVM transaction (RLP encoded) */
  signEthTransaction(
    chainId: number,
    derivationPath: string,
    rlpPayload: Uint8Array,
    isEIP1559: boolean,
  ): Promise<{ r: string; s: string; v: number }>;

  /** Sign a personal message */
  signMessage(chainId: number, derivationPath: string, message: Uint8Array): Promise<Uint8Array>;
}

/**
 * Transport abstraction — matches the Rust library's ReadWrite trait.
 * Each transport (USB HID, BLE) implements this interface.
 * The BitBox protocol stack (Noise, Protobuf, signing) sits on top.
 */
export interface BitboxTransport {
  /** Write raw bytes to device */
  write(data: Uint8Array): Promise<number>;

  /** Read raw bytes from device */
  read(): Promise<Uint8Array>;

  /** Close the transport connection */
  close(): Promise<void>;
}

/** Default ETH derivation path (BIP-44) */
export const DEFAULT_ETH_DERIVATION_PATH = "m/44'/60'/0'/0/0";

/** Default BTC derivation path (BIP-84 native segwit) */
export const DEFAULT_BTC_DERIVATION_PATH = "m/84'/0'/0'/0/0";
