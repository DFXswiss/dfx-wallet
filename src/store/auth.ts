import { create } from 'zustand';
import { secureStorage, StorageKeys } from '@/services/storage';

type AuthState = {
  isOnboarded: boolean;
  isAuthenticated: boolean;
  isDfxAuthenticated: boolean;
  pinHash: string | null;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setOnboarded: (value: boolean) => void;
  setAuthenticated: (value: boolean) => void;
  setDfxAuthenticated: (value: boolean) => void;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  reset: () => Promise<void>;
};

/** Simple hash for PIN (not cryptographic — use PBKDF2 in production) */
function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isOnboarded: false,
  isAuthenticated: false,
  isDfxAuthenticated: false,
  pinHash: null,
  isHydrated: false,

  /** Load persisted state from secure storage */
  hydrate: async () => {
    const [pinHash, isOnboarded, dfxToken] = await Promise.all([
      secureStorage.get(StorageKeys.PIN_HASH),
      secureStorage.get(StorageKeys.IS_ONBOARDED),
      secureStorage.get(StorageKeys.DFX_AUTH_TOKEN),
    ]);

    set({
      pinHash,
      isOnboarded: isOnboarded === 'true',
      isDfxAuthenticated: dfxToken !== null,
      isHydrated: true,
    });
  },

  setOnboarded: (value) => {
    secureStorage.set(StorageKeys.IS_ONBOARDED, String(value));
    set({ isOnboarded: value });
  },

  setAuthenticated: (value) => set({ isAuthenticated: value }),

  setDfxAuthenticated: (value) => set({ isDfxAuthenticated: value }),

  setPin: async (pin) => {
    const hash = hashPin(pin);
    await secureStorage.set(StorageKeys.PIN_HASH, hash);
    set({ pinHash: hash });
  },

  verifyPin: async (pin) => {
    const { pinHash } = get();
    if (!pinHash) return false;
    return hashPin(pin) === pinHash;
  },

  reset: async () => {
    await Promise.all([
      secureStorage.remove(StorageKeys.PIN_HASH),
      secureStorage.remove(StorageKeys.IS_ONBOARDED),
      secureStorage.remove(StorageKeys.ENCRYPTED_SEED),
      secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN),
    ]);
    set({
      isOnboarded: false,
      isAuthenticated: false,
      isDfxAuthenticated: false,
      pinHash: null,
    });
  },
}));
