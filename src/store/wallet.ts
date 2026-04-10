import { create } from 'zustand';
import type { ChainId } from '@/config/chains';

export type WalletType = 'software' | 'hardware';

export type Asset = {
  symbol: string;
  name: string;
  chain: ChainId;
  balance: string;
  balanceFiat: string;
  decimals: number;
  contractAddress?: string;
  iconUrl?: string;
};

export type WalletAccount = {
  chain: ChainId;
  address: string;
  derivationPath: string;
};

type WalletState = {
  walletType: WalletType | null;
  accounts: WalletAccount[];
  assets: Asset[];
  totalBalanceFiat: string;
  selectedCurrency: string;
  isLoading: boolean;

  setWalletType: (type: WalletType) => void;
  setAccounts: (accounts: WalletAccount[]) => void;
  addAccount: (account: WalletAccount) => void;
  setAssets: (assets: Asset[]) => void;
  setTotalBalanceFiat: (balance: string) => void;
  setSelectedCurrency: (currency: string) => void;
  setLoading: (loading: boolean) => void;
  getAccountForChain: (chain: ChainId) => WalletAccount | undefined;
  reset: () => void;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  walletType: null,
  accounts: [],
  assets: [],
  totalBalanceFiat: '0.00',
  selectedCurrency: 'CHF',
  isLoading: false,

  setWalletType: (type) => set({ walletType: type }),
  setAccounts: (accounts) => set({ accounts }),
  addAccount: (account) => set((state) => ({ accounts: [...state.accounts, account] })),
  setAssets: (assets) => set({ assets }),
  setTotalBalanceFiat: (balance) => set({ totalBalanceFiat: balance }),
  setSelectedCurrency: (currency) => set({ selectedCurrency: currency }),
  setLoading: (loading) => set({ isLoading: loading }),
  getAccountForChain: (chain) => get().accounts.find((a) => a.chain === chain),
  reset: () =>
    set({
      walletType: null,
      accounts: [],
      assets: [],
      totalBalanceFiat: '0.00',
      isLoading: false,
    }),
}));
