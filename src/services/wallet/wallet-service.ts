import type { ChainId } from '@/config/chains';
import { CHAINS_CONFIG } from '@/config/chains';
import type { WalletAccount } from '@/store/wallet';

/**
 * Wallet service — manages WDK wallet lifecycle.
 *
 * Handles wallet creation, restoration, account derivation,
 * balance fetching, and transaction signing via WDK.
 */
export class WalletService {
  private isInitialized = false;

  /**
   * Initialize WDK with a seed phrase and register chain modules.
   */
  async initialize(seedPhrase: string): Promise<void> {
    // TODO: Initialize WDK core with seed
    //
    // const wdk = new WDK(seedPhrase)
    //   .registerWallet('bitcoin', WalletManagerBtc, {
    //     host: CHAINS_CONFIG.bitcoin.host,
    //     port: CHAINS_CONFIG.bitcoin.port,
    //   })
    //   .registerWallet('ethereum', WalletManagerEvm, {
    //     provider: CHAINS_CONFIG.ethereum.provider,
    //   })
    //   .registerWallet('arbitrum', WalletManagerEvm, {
    //     provider: CHAINS_CONFIG.arbitrum.provider,
    //   })
    //   .registerWallet('polygon', WalletManagerEvm, {
    //     provider: CHAINS_CONFIG.polygon.provider,
    //   })
    //   .registerWallet('optimism', WalletManagerEvm, {
    //     provider: CHAINS_CONFIG.optimism.provider,
    //   })
    //   .registerWallet('base', WalletManagerEvm, {
    //     provider: CHAINS_CONFIG.base.provider,
    //   });

    this.isInitialized = true;
  }

  /**
   * Derive accounts for all supported chains.
   */
  async deriveAccounts(): Promise<WalletAccount[]> {
    this.ensureInitialized();

    // TODO: Derive accounts from WDK for each registered chain
    // const ethAccount = await wdk.getAccount('ethereum', 0);
    // const btcAccount = await wdk.getAccount('bitcoin', 0);

    const chains = Object.keys(CHAINS_CONFIG) as ChainId[];
    const accounts: WalletAccount[] = chains.map((chain) => ({
      chain,
      address: '', // Will be populated by WDK
      derivationPath: chain === 'bitcoin' ? "m/84'/0'/0'/0/0" : "m/44'/60'/0'/0/0",
    }));

    return accounts;
  }

  /**
   * Get balance for a specific chain account.
   */
  async getBalance(chain: ChainId, accountIndex: number = 0): Promise<string> {
    this.ensureInitialized();
    // TODO: const account = await wdk.getAccount(chain, accountIndex);
    // return account.getBalance();
    return '0';
  }

  /**
   * Get all token balances across chains.
   */
  async getAllBalances(): Promise<
    Array<{
      chain: ChainId;
      symbol: string;
      name: string;
      balance: string;
      decimals: number;
      contractAddress?: string;
    }>
  > {
    this.ensureInitialized();
    // TODO: Query WDK indexer for all token balances
    return [];
  }

  /**
   * Send a native transaction on a specific chain.
   */
  async sendTransaction(params: {
    chain: ChainId;
    to: string;
    amount: string;
    accountIndex?: number;
  }): Promise<string> {
    this.ensureInitialized();
    // TODO: const account = await wdk.getAccount(params.chain, params.accountIndex ?? 0);
    // const tx = await account.sendTransaction({ to: params.to, value: params.amount });
    // return tx.hash;
    throw new Error('sendTransaction not yet implemented');
  }

  /**
   * Send an ERC20 token transfer.
   */
  async sendToken(params: {
    chain: ChainId;
    contractAddress: string;
    to: string;
    amount: string;
    accountIndex?: number;
  }): Promise<string> {
    this.ensureInitialized();
    // TODO: Use WDK ERC20 transfer
    throw new Error('sendToken not yet implemented');
  }

  /**
   * Sign a personal message (used for DFX API auth).
   */
  async signMessage(chain: ChainId, message: string, accountIndex: number = 0): Promise<string> {
    this.ensureInitialized();
    // TODO: const account = await wdk.getAccount(chain, accountIndex);
    // return account.sign(message);
    throw new Error('signMessage not yet implemented');
  }

  /**
   * Get the receive address for a chain.
   */
  async getAddress(chain: ChainId, accountIndex: number = 0): Promise<string> {
    this.ensureInitialized();
    // TODO: const account = await wdk.getAccount(chain, accountIndex);
    // return account.getAddress();
    return '';
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('WalletService not initialized. Call initialize() first.');
    }
  }
}

/** Singleton wallet service instance */
export const walletService = new WalletService();
