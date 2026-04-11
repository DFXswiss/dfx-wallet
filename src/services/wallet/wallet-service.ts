import { wdkService, AssetTicker, type NetworkType } from '@tetherto/wdk-react-native-provider';
import type { ChainId } from '@/config/chains';

const CHAIN_TO_NETWORK: Record<ChainId, NetworkType> = {
  bitcoin: 'bitcoin' as NetworkType,
  ethereum: 'ethereum' as NetworkType,
  arbitrum: 'arbitrum' as NetworkType,
  polygon: 'polygon' as NetworkType,
};

/**
 * Wallet service — thin wrapper around WDK's wdkService singleton.
 *
 * WDK handles all crypto operations inside isolated Bare Worklets:
 * - Seed generation + encryption (wdk-secret-manager worklet)
 * - Address derivation, signing, tx building (wdk-manager worklet)
 * - Keys never leave the worklet context
 */
export class WalletService {
  /**
   * Get address for a specific chain.
   */
  async getAddress(chain: ChainId): Promise<string | null> {
    const network = CHAIN_TO_NETWORK[chain];
    if (!network) return null;

    try {
      const enabledAssets = Object.values(AssetTicker);
      const addresses = await wdkService.resolveWalletAddresses(enabledAssets);
      return addresses[network] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Sign a personal message (used for DFX API auth).
   * Delegates to WDK's Bare Worklet where the private key lives.
   */
  async signMessage(chain: ChainId, message: string): Promise<string> {
    const network = CHAIN_TO_NETWORK[chain];
    if (!network) throw new Error(`Unsupported chain: ${chain}`);

    // WDK exposes signing through the worklet RPC
    // The actual implementation depends on the WDK version
    // For EVM chains, this is personal_sign
    const result = await (wdkService as any).signMessage?.(network, message);
    if (!result) throw new Error('signMessage not available in current WDK version');
    return result;
  }

  /**
   * Send a native transaction on a specific chain.
   */
  async sendTransaction(params: {
    chain: ChainId;
    to: string;
    amount: string;
  }): Promise<string> {
    const network = CHAIN_TO_NETWORK[params.chain];
    if (!network) throw new Error(`Unsupported chain: ${params.chain}`);

    const result = await (wdkService as any).sendTransaction?.({
      network,
      to: params.to,
      amount: params.amount,
    });
    if (!result) throw new Error('sendTransaction not available in current WDK version');
    return result.hash ?? result;
  }
}

export const walletService = new WalletService();
