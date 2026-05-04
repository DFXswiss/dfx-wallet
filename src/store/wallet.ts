import { create } from 'zustand';
import type { ChainId } from '@/config/chains';

export type WalletType = 'software' | 'hardware';

type WalletState = {
  walletType: WalletType | null;
  selectedCurrency: string;
  selectedChain: ChainId;
  totalBalanceFiat: string;

  setWalletType: (type: WalletType) => void;
  setSelectedCurrency: (currency: string) => void;
  setSelectedChain: (chain: ChainId) => void;
  setTotalBalanceFiat: (balance: string) => void;
  reset: () => void;
};

const INITIAL_STATE = {
  walletType: null as WalletType | null,
  selectedCurrency: 'CHF',
  selectedChain: 'ethereum' as ChainId,
  totalBalanceFiat: '0.00',
};

export const useWalletStore = create<WalletState>((set) => ({
  ...INITIAL_STATE,

  setWalletType: (type) => set({ walletType: type }),
  setSelectedCurrency: (currency) => set({ selectedCurrency: currency }),
  setSelectedChain: (chain) => set({ selectedChain: chain }),
  setTotalBalanceFiat: (balance) => set({ totalBalanceFiat: balance }),
  reset: () => set(INITIAL_STATE),
}));
