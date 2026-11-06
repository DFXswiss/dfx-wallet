import { create } from 'zustand';
import type { ChainId } from '@/config/chains';
import { secureStorage, StorageKeys } from '@/services/storage';

export type WalletType = 'software' | 'hardware';

type WalletState = {
  walletType: WalletType | null;
  selectedCurrency: string;
  selectedChain: ChainId;
  totalBalanceFiat: string;

  hydrate: () => Promise<void>;
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

const ALLOWED_CURRENCIES = new Set(['CHF', 'EUR', 'USD']);

export const useWalletStore = create<WalletState>((set) => ({
  ...INITIAL_STATE,

  /**
   * Read the persisted currency (and any future preferences) from
   * secure storage so a setting the user picked on a previous launch
   * survives an app restart. Called once at boot from the root layout;
   * the in-memory default (`CHF`) is the fallback for first-run users
   * and for the brief moment before hydration finishes.
   */
  hydrate: async () => {
    const stored = await secureStorage.get(StorageKeys.SELECTED_CURRENCY);
    if (stored && ALLOWED_CURRENCIES.has(stored)) {
      set({ selectedCurrency: stored });
    }
  },

  setWalletType: (type) => set({ walletType: type }),

  /**
   * Persist the user's currency pick so it survives an app restart.
   * Without this the Zustand store reset to the in-memory `CHF` default
   * every relaunch and the user had to re-pick EUR every time.
   */
  setSelectedCurrency: (currency) => {
    set({ selectedCurrency: currency });
    if (ALLOWED_CURRENCIES.has(currency)) {
      void secureStorage.set(StorageKeys.SELECTED_CURRENCY, currency);
    }
  },

  setSelectedChain: (chain) => set({ selectedChain: chain }),
  setTotalBalanceFiat: (balance) => set({ totalBalanceFiat: balance }),
  reset: () => {
    set(INITIAL_STATE);
    void secureStorage.remove(StorageKeys.SELECTED_CURRENCY);
  },
}));
