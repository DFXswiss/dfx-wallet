export type HardwareWalletType = 'bitbox02';

export type HardwareWalletDevice = {
  id: string;
  name: string;
  type: HardwareWalletType;
};

export type HardwareWalletStatus =
  | 'disconnected'
  | 'detected'
  | 'connecting'
  | 'verifying'
  | 'connected';

export interface HardwareWalletProvider {
  /** Poll for connected USB devices */
  scanDevices(): Promise<HardwareWalletDevice[]>;

  /** Establish connection and verify secure channel */
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
  signMessage(
    chainId: number,
    derivationPath: string,
    message: Uint8Array,
  ): Promise<Uint8Array>;
}

/** Default ETH derivation path (BIP-44) */
export const DEFAULT_ETH_DERIVATION_PATH = "m/44'/60'/0'/0/0";

/** Default BTC derivation path (BIP-84 native segwit) */
export const DEFAULT_BTC_DERIVATION_PATH = "m/84'/0'/0'/0/0";
