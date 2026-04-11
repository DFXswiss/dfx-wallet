export const WalletProvider = ({ children }: { children: unknown }) => children;
export const useWallet = jest.fn(() => ({
  wallet: null,
  addresses: {},
  balances: { list: [], map: {}, isLoading: false },
  transactions: { list: [], map: {}, isLoading: false },
  isLoading: false,
  error: null,
  isInitialized: false,
  isUnlocked: false,
  createWallet: jest.fn(),
  clearWallet: jest.fn(),
  clearError: jest.fn(),
  refreshWalletBalance: jest.fn(),
  refreshTransactions: jest.fn(),
  unlockWallet: jest.fn(),
}));
export const wdkService = {};
