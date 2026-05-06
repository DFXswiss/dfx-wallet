export const WdkAppProvider = ({ children }: { children: unknown }) => children;

export const useWalletManager = jest.fn(() => ({
  activeWalletId: null,
  status: 'NO_WALLET',
  setActiveWalletId: jest.fn(),
  wallets: [],
  createWallet: jest.fn(),
  restoreWallet: jest.fn(),
  generateMnemonic: jest.fn(),
  deleteWallet: jest.fn(),
  lock: jest.fn(),
  unlock: jest.fn(),
  clearCache: jest.fn(),
  createTemporaryWallet: jest.fn(),
}));

export const useWdkApp = jest.fn(() => ({
  state: { status: 'INITIALIZING' as const },
  retry: jest.fn(),
  reinitializeWdk: jest.fn(),
  resetWallets: jest.fn(),
}));

export const useAccount = jest.fn(() => ({
  address: null,
  isLoading: false,
  error: null,
  account: null,
  getBalance: jest.fn(),
  send: jest.fn(),
  sign: jest.fn(),
  verify: jest.fn(),
  estimateFee: jest.fn(),
  extension: jest.fn(),
}));

export const useAddresses = jest.fn(() => ({
  data: undefined,
  isLoading: false,
  loadAddresses: jest.fn(),
  getAddressesForNetwork: jest.fn(() => []),
  getAccountInfoFromAddress: jest.fn(),
}));

export const useBalance = jest.fn(() => ({ data: undefined, isLoading: false, error: null }));
export const useBalancesForWallet = jest.fn(() => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn(),
}));
export const useRefreshBalance = jest.fn(() => ({ mutate: jest.fn() }));

export const validateMnemonic = jest.fn(() => true);

export class BaseAsset {
  constructor(private readonly config: Record<string, unknown>) {}
  getId() {
    return this.config['id'] as string;
  }
  getNetwork() {
    return this.config['network'] as string;
  }
  getSymbol() {
    return this.config['symbol'] as string;
  }
  getName() {
    return this.config['name'] as string;
  }
  getDecimals() {
    return this.config['decimals'] as number;
  }
  isNative() {
    return this.config['isNative'] as boolean;
  }
  getContractAddress() {
    return (this.config['address'] as string | null | undefined) ?? null;
  }
}
