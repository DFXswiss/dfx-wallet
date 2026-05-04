export const WdkAppProvider = ({ children }: { children: unknown }) => children;

const baseWalletData = {
  addresses: {} as Record<string, Record<number, string>>,
  walletLoading: {} as Record<string, boolean>,
  isInitialized: false,
  isSwitchingWallet: false,
  switchingToWalletId: null,
  switchWalletError: null,
  isTemporaryWallet: false,
};

export const useWallet = jest.fn(() => ({
  ...baseWalletData,
  getNetworkAddresses: jest.fn(() => ({})),
  isLoadingAddress: jest.fn(() => false),
  getAddress: jest.fn(),
  callAccountMethod: jest.fn(),
}));

export const useWalletManager = jest.fn(() => ({
  initializeWallet: jest.fn(),
  initializeFromMnemonic: jest.fn(),
  hasWallet: jest.fn(),
  deleteWallet: jest.fn(),
  getMnemonic: jest.fn(),
  createTemporaryWallet: jest.fn(),
  isInitializing: false,
  error: null,
  clearError: jest.fn(),
  clearActiveWallet: jest.fn(),
  wallets: [],
  activeWalletId: null,
  createWallet: jest.fn(),
  refreshWalletList: jest.fn(),
  isWalletListLoading: false,
  walletListError: null,
}));

export const useWdkApp = jest.fn(() => ({
  status: 'not_loaded',
  workletStatus: 'not_started',
  workletState: { isReady: false, isLoading: false, error: null },
  walletState: { status: 'not_loaded', identifier: null, error: null },
  isInitializing: false,
  isReady: false,
  activeWalletId: null,
  loadingWalletId: null,
  walletExists: null,
  error: null,
  retry: jest.fn(),
}));

export const useBalance = jest.fn(() => ({ data: undefined, isLoading: false, error: null }));
export const useBalancesForWallet = jest.fn(() => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: jest.fn(),
}));
export const useRefreshBalance = jest.fn(() => ({ mutate: jest.fn() }));
