import { create } from 'zustand';
import { hashPin, verifyPin as verifyPinHash } from '@/services/pin';
import { authenticateWithBiometric, isBiometricAvailable } from '@/services/biometric';
import { secureStorage, StorageKeys } from '@/services/storage';

type AuthState = {
  isOnboarded: boolean;
  isAuthenticated: boolean;
  isDfxAuthenticated: boolean;
  biometricEnabled: boolean;
  pinHash: string | null;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setOnboarded: (value: boolean) => Promise<void>;
  setAuthenticated: (value: boolean) => void;
  setDfxAuthenticated: (value: boolean) => void;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  authenticateBiometric: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  reset: () => Promise<void>;
};

const BIOMETRIC_KEY = 'biometricEnabled';

export const useAuthStore = create<AuthState>((set, get) => ({
  isOnboarded: false,
  isAuthenticated: false,
  isDfxAuthenticated: false,
  biometricEnabled: false,
  pinHash: null,
  isHydrated: false,

  hydrate: async () => {
    const [pinHash, isOnboarded, dfxToken, biometric] = await Promise.all([
      secureStorage.get(StorageKeys.PIN_HASH),
      secureStorage.get(StorageKeys.IS_ONBOARDED),
      secureStorage.get(StorageKeys.DFX_AUTH_TOKEN),
      secureStorage.get(BIOMETRIC_KEY),
    ]);

    set({
      pinHash,
      isOnboarded: isOnboarded === 'true',
      isDfxAuthenticated: dfxToken !== null,
      biometricEnabled: biometric === 'true',
      isHydrated: true,
    });
  },

  setOnboarded: async (value) => {
    await secureStorage.set(StorageKeys.IS_ONBOARDED, String(value));
    set({ isOnboarded: value });
  },

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setDfxAuthenticated: (value) => set({ isDfxAuthenticated: value }),

  setPin: async (pin) => {
    const hash = await hashPin(pin);
    await secureStorage.set(StorageKeys.PIN_HASH, hash);
    set({ pinHash: hash });
  },

  verifyPin: async (pin) => {
    const { pinHash } = get();
    if (!pinHash) return false;
    return verifyPinHash(pin, pinHash);
  },

  authenticateBiometric: async () => {
    const { biometricEnabled } = get();
    if (!biometricEnabled) return false;
    const available = await isBiometricAvailable();
    if (!available) return false;
    return authenticateWithBiometric();
  },

  setBiometricEnabled: async (enabled) => {
    if (enabled) {
      const available = await isBiometricAvailable();
      if (!available) return;
    }
    await secureStorage.set(BIOMETRIC_KEY, String(enabled));
    set({ biometricEnabled: enabled });
  },

  reset: async () => {
    await Promise.all([
      secureStorage.remove(StorageKeys.PIN_HASH),
      secureStorage.remove(StorageKeys.IS_ONBOARDED),
      secureStorage.remove(StorageKeys.ENCRYPTED_SEED),
      secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN),
      secureStorage.remove(BIOMETRIC_KEY),
    ]);
    set({
      isOnboarded: false,
      isAuthenticated: false,
      isDfxAuthenticated: false,
      biometricEnabled: false,
      pinHash: null,
    });
  },
}));
