import { create } from 'zustand';
import { FEATURES } from '@/config/features';
import { hashPin, needsPinRehash, verifyPin as verifyPinHash } from '@/services/pin';
import { secureStorage, StorageKeys } from '@/services/storage';

/**
 * Lazy handle to the biometric service. Resolved through a conditional
 * `require()` so a build with `EXPO_PUBLIC_ENABLE_BIOMETRIC` off does
 * not load `expo-local-authentication` (the only thing the biometric
 * module imports) into the MVP bundle. `authenticateBiometric` below
 * checks the same flag and short-circuits when the module is absent.
 */
const biometricModule: {
  authenticateWithBiometric: (options: BiometricPromptOptions) => Promise<boolean>;
  isBiometricAvailable: () => Promise<boolean>;
} | null = FEATURES.BIOMETRIC
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/biometric/biometric')
  : null;

/**
 * Lazy handle to the DFX API client and auth service. The store needs
 * them only when rehydrating a persisted DFX session token; when
 * `EXPO_PUBLIC_ENABLE_DFX_BACKEND` is off there is no DFX session, so
 * the import is elided entirely and the rehydrate path is a no-op.
 */
const dfxModule: {
  dfxApi: {
    setAuthToken: (token: string) => void;
    clearAuthToken: () => void;
  };
  dfxAuthService: {
    adoptStoredToken: (token: string | null) => void;
  };
} | null = FEATURES.DFX_BACKEND
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/dfx-backend/services')
  : null;

type AuthState = {
  isOnboarded: boolean;
  isAuthenticated: boolean;
  isDfxAuthenticated: boolean;
  biometricEnabled: boolean;
  pinHash: string | null;
  failedAttempts: number;
  lockedUntil: number | null;
  isHydrated: boolean;
  hydrateError: string | null;

  hydrate: () => Promise<void>;
  setOnboarded: (value: boolean) => Promise<void>;
  setAuthenticated: (value: boolean) => void;
  setDfxAuthenticated: (value: boolean) => void;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string, options?: VerifyPinOptions) => Promise<boolean>;
  authenticateBiometric: (options: BiometricPromptOptions) => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  reset: () => Promise<void>;
};

type VerifyPinOptions = {
  recordFailure?: boolean;
};

export type BiometricPromptOptions = {
  promptMessage: string;
  cancelLabel: string;
};

export class PinOverwriteNotAllowedError extends Error {
  constructor() {
    super('An existing PIN cannot be replaced while the wallet is locked');
    this.name = 'PinOverwriteNotAllowedError';
  }
}

const FIRST_LOCKOUT_ATTEMPT = 5;
const INITIAL_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;

export function pinLockoutMs(failedAttempts: number): number {
  if (failedAttempts < FIRST_LOCKOUT_ATTEMPT) return 0;
  return Math.min(
    INITIAL_LOCKOUT_MS * 2 ** (failedAttempts - FIRST_LOCKOUT_ATTEMPT),
    MAX_LOCKOUT_MS,
  );
}

export type PostPinDestination = {
  route: '/(auth)/(tabs)/dashboard' | '/(onboarding)/legal-disclaimer';
  shouldSetOnboarded: boolean;
};

export function getPostPinDestination(
  isOnboarded: boolean,
  legalEnabled: boolean,
): PostPinDestination {
  if (isOnboarded) {
    return { route: '/(auth)/(tabs)/dashboard', shouldSetOnboarded: false };
  }
  if (legalEnabled) {
    return { route: '/(onboarding)/legal-disclaimer', shouldSetOnboarded: false };
  }
  return { route: '/(auth)/(tabs)/dashboard', shouldSetOnboarded: true };
}

const BIOMETRIC_KEY = 'biometricEnabled';

export const useAuthStore = create<AuthState>((set, get) => ({
  isOnboarded: false,
  isAuthenticated: false,
  isDfxAuthenticated: false,
  biometricEnabled: false,
  pinHash: null,
  failedAttempts: 0,
  lockedUntil: null,
  isHydrated: false,
  hydrateError: null,

  hydrate: async () => {
    set({ hydrateError: null });
    try {
      const [pinHash, isOnboarded, dfxToken, biometric, failedAttempts, lockedUntil] =
        await Promise.all([
          secureStorage.get(StorageKeys.PIN_HASH),
          secureStorage.get(StorageKeys.IS_ONBOARDED),
          secureStorage.get(StorageKeys.DFX_AUTH_TOKEN),
          secureStorage.get(BIOMETRIC_KEY),
          secureStorage.get(StorageKeys.PIN_FAILED_ATTEMPTS),
          secureStorage.get(StorageKeys.PIN_LOCKED_UNTIL),
        ]);

      // Re-arm both the API client and the auth service with the persisted
      // token so authenticated requests work after a cold start, and so the
      // service's `linkAddress` / `isAuthenticated` checks see the same token
      // the API client is sending out. With the DFX backend deferred there is
      // no client to arm — the persisted token can stay where it is in secure
      // storage until a build with the flag on picks it up.
      if (dfxModule) {
        if (dfxToken) {
          dfxModule.dfxApi.setAuthToken(dfxToken);
          dfxModule.dfxAuthService.adoptStoredToken(dfxToken);
        } else {
          dfxModule.dfxApi.clearAuthToken();
          dfxModule.dfxAuthService.adoptStoredToken(null);
        }
      }

      set({
        pinHash,
        isOnboarded: isOnboarded === 'true',
        isDfxAuthenticated: dfxToken !== null,
        biometricEnabled: biometric === 'true',
        failedAttempts: failedAttempts ? Number(failedAttempts) : 0,
        lockedUntil: lockedUntil ? Number(lockedUntil) : null,
        isHydrated: true,
        hydrateError: null,
      });
    } catch (error) {
      set({
        hydrateError: error instanceof Error ? error.message : 'Authentication storage unavailable',
        isHydrated: false,
      });
    }
  },

  setOnboarded: async (value) => {
    await secureStorage.set(StorageKeys.IS_ONBOARDED, String(value));
    set({ isOnboarded: value });
  },

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setDfxAuthenticated: (value) => set({ isDfxAuthenticated: value }),

  setPin: async (pin) => {
    const { pinHash, isAuthenticated } = get();
    if (pinHash && !isAuthenticated) throw new PinOverwriteNotAllowedError();
    const hash = await hashPin(pin);
    await secureStorage.set(StorageKeys.PIN_HASH, hash);
    set({ pinHash: hash });
  },

  verifyPin: async (pin, { recordFailure = true } = {}) => {
    const { pinHash, failedAttempts, lockedUntil } = get();
    if (!pinHash) return false;
    if (lockedUntil && lockedUntil > Date.now()) return false;
    const ok = await verifyPinHash(pin, pinHash);
    if (!ok) {
      if (!recordFailure) return false;
      const nextAttempts = failedAttempts + 1;
      const lockoutMs = pinLockoutMs(nextAttempts);
      const nextLockedUntil = lockoutMs > 0 ? Date.now() + lockoutMs : null;
      set({ failedAttempts: nextAttempts, lockedUntil: nextLockedUntil });
      try {
        await Promise.all([
          secureStorage.set(StorageKeys.PIN_FAILED_ATTEMPTS, String(nextAttempts)),
          nextLockedUntil
            ? secureStorage.set(StorageKeys.PIN_LOCKED_UNTIL, String(nextLockedUntil))
            : secureStorage.remove(StorageKeys.PIN_LOCKED_UNTIL),
        ]);
      } catch {
        return false;
      }
      return false;
    }
    await Promise.all([
      secureStorage.remove(StorageKeys.PIN_FAILED_ATTEMPTS),
      secureStorage.remove(StorageKeys.PIN_LOCKED_UNTIL),
    ]);
    set({ failedAttempts: 0, lockedUntil: null });
    if (ok && needsPinRehash(pinHash)) {
      void (async () => {
        try {
          const migratedHash = await hashPin(pin);
          await secureStorage.set(StorageKeys.PIN_HASH, migratedHash);
          if (get().pinHash === pinHash) set({ pinHash: migratedHash });
        } catch {
          // Authentication succeeded; keep the legacy hash and retry migration
          // on the next successful unlock rather than locking out the user.
        }
      })();
    }
    return ok;
  },

  authenticateBiometric: async (options) => {
    if (!biometricModule) return false;
    const { biometricEnabled } = get();
    if (!biometricEnabled) return false;
    const available = await biometricModule.isBiometricAvailable();
    if (!available) return false;
    return biometricModule.authenticateWithBiometric(options);
  },

  setBiometricEnabled: async (enabled) => {
    // Persist the user's preference unconditionally — the lock screen
    // already gates `authenticateBiometric` on a live hardware check
    // before prompting, so saving "enabled = true" on a simulator does
    // no harm. Silently dropping the write here previously made the
    // Settings toggle appear broken (it bounced straight back to off).
    await secureStorage.set(BIOMETRIC_KEY, String(enabled));
    set({ biometricEnabled: enabled });
  },

  reset: async () => {
    const cleanupTasks: (() => void | Promise<void>)[] = [
      () => secureStorage.remove(StorageKeys.ACCOUNTS),
      () => secureStorage.remove(StorageKeys.DFX_LINKED_CHAINS),
      () => secureStorage.remove(StorageKeys.PIN_HASH),
      () => secureStorage.remove(StorageKeys.IS_ONBOARDED),
      () => secureStorage.remove(StorageKeys.ENCRYPTED_SEED),
      () => secureStorage.remove(StorageKeys.DFX_AUTH_TOKEN),
      () => secureStorage.remove(StorageKeys.WALLET_ORIGIN),
      () => secureStorage.remove(StorageKeys.PASSKEY_CREDENTIAL_ID),
      () => secureStorage.remove(StorageKeys.PASSKEY_DERIVATION_VERSION),
      () => secureStorage.remove(StorageKeys.PIN_FAILED_ATTEMPTS),
      () => secureStorage.remove(StorageKeys.PIN_LOCKED_UNTIL),
      () => secureStorage.remove(StorageKeys.WALLET_TYPE),
      () => secureStorage.remove(BIOMETRIC_KEY),
    ];
    if (dfxModule) {
      cleanupTasks.push(
        () => dfxModule.dfxApi.clearAuthToken(),
        () => dfxModule.dfxAuthService.adoptStoredToken(null),
      );
    }

    let failures: unknown[] = [];
    try {
      const results = await Promise.allSettled(
        cleanupTasks.map(async (cleanup) => {
          await cleanup();
        }),
      );
      failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason);
    } finally {
      set({
        isOnboarded: false,
        isAuthenticated: false,
        isDfxAuthenticated: false,
        biometricEnabled: false,
        pinHash: null,
        failedAttempts: 0,
        lockedUntil: null,
        hydrateError: null,
      });
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Failed to clear all wallet access data');
    }
  },
}));
