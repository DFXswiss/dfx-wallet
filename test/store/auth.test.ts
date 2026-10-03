// `src/services/pin.ts` now calls the native argon2 from
// react-native-quick-crypto, which isn't available under the unit Jest
// project (`react-native-nitro-modules` is mapped to an empty stub here).
// Replace it with the same fast, deterministic fake develop previously used
// for `@noble/hashes/argon2` (XOR over `${password}:${salt}`), reshaped for
// the native callback API — running the real Argon2id (m=32768, t=3) for
// every setPin/verifyPin call in this suite pushed it well past Jest's
// default 5s test timeout. This file has no compatibility assertion, so it
// never needs the real implementation.
type NativeArgon2Params = {
  message: Uint8Array;
  nonce: Uint8Array;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
  version: number;
};

jest.mock('react-native-quick-crypto', () => ({
  argon2: jest.fn(
    (
      _algorithm: string,
      params: NativeArgon2Params,
      callback: (err: Error | null, result: Uint8Array) => void,
    ) => {
      const password = new TextDecoder().decode(params.message);
      const bytes = new Uint8Array(params.tagLength);
      const input = `${password}:${Array.from(params.nonce).join(',')}`;
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = input.charCodeAt(i % input.length) ^ i;
      }
      callback(null, bytes);
    },
  ),
}));

jest.mock('@/services/pin', () => {
  const actual = jest.requireActual<typeof import('@/services/pin')>('@/services/pin');
  return { ...actual, verifyPin: jest.fn(actual.verifyPin) };
});

import * as SecureStore from 'expo-secure-store';
import * as LA from 'expo-local-authentication';
import { waitFor } from '@testing-library/react-native';
import { dfxApi, dfxAuthService } from '@/features/dfx-backend/services';
import * as PinService from '@/services/pin';
import {
  getPostPinDestination,
  PinOverwriteNotAllowedError,
  pinLockoutMs,
  useAuthStore,
} from '../../src/store/auth';

const setItemMock = SecureStore.setItemAsync as jest.Mock;
const getItemMock = SecureStore.getItemAsync as jest.Mock;
const deleteItemMock = SecureStore.deleteItemAsync as jest.Mock;
const hasHardwareMock = LA.hasHardwareAsync as jest.Mock;
const isEnrolledMock = LA.isEnrolledAsync as jest.Mock;
const authenticateMock = LA.authenticateAsync as jest.Mock;
const verifyPinHashMock = PinService.verifyPin as jest.Mock;
const biometricOptions = { promptMessage: 'Unlock wallet', cancelLabel: 'Use PIN' };

const initialState = useAuthStore.getState();

const legacyHashPin = async (pin: string): Promise<string> => {
  const Crypto = await import('expo-crypto');
  let hash = `dfx-wallet-pin-v1:${pin}`;
  for (let i = 0; i < 10000; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
};

beforeEach(() => {
  setItemMock.mockReset();
  getItemMock.mockReset();
  deleteItemMock.mockReset();
  hasHardwareMock.mockReset();
  isEnrolledMock.mockReset();
  authenticateMock.mockReset();
  verifyPinHashMock.mockClear();
  setItemMock.mockImplementation(async () => undefined);
  getItemMock.mockImplementation(async () => null);
  deleteItemMock.mockImplementation(async () => undefined);
  hasHardwareMock.mockResolvedValue(true);
  isEnrolledMock.mockResolvedValue(true);
  authenticateMock.mockResolvedValue({ success: true });
  useAuthStore.setState({ ...initialState }, true);
});

describe('pinLockoutMs', () => {
  it.each([0, 1, 2, 3, 4])('returns no delay before attempt %i', (attempts) => {
    expect(pinLockoutMs(attempts)).toBe(0);
  });

  it.each([
    [5, 30_000],
    [6, 60_000],
    [7, 120_000],
  ])('returns an exponential delay for attempt %i', (attempts, expected) => {
    expect(pinLockoutMs(attempts)).toBe(expected);
  });

  it('caps the delay at one hour', () => {
    expect(pinLockoutMs(100)).toBe(3_600_000);
  });
});

describe('getPostPinDestination', () => {
  it('routes onboarded users to the dashboard', () => {
    expect(getPostPinDestination(true, true)).toEqual({
      route: '/(auth)/(tabs)/dashboard',
      shouldSetOnboarded: false,
    });
  });

  it('routes unfinished onboarding to the legal disclaimer when enabled', () => {
    expect(getPostPinDestination(false, true)).toEqual({
      route: '/(onboarding)/legal-disclaimer',
      shouldSetOnboarded: false,
    });
  });

  it('finishes onboarding and routes to the dashboard when legal is disabled', () => {
    expect(getPostPinDestination(false, false)).toEqual({
      route: '/(auth)/(tabs)/dashboard',
      shouldSetOnboarded: true,
    });
  });
});

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('starts unauthenticated and unhydrated', () => {
      const s = useAuthStore.getState();
      expect(s.isOnboarded).toBe(false);
      expect(s.isAuthenticated).toBe(false);
      expect(s.isDfxAuthenticated).toBe(false);
      expect(s.biometricEnabled).toBe(false);
      expect(s.pinHash).toBeNull();
      expect(s.failedAttempts).toBe(0);
      expect(s.lockedUntil).toBeNull();
      expect(s.isHydrated).toBe(false);
      expect(s.hydrateError).toBeNull();
    });
  });

  describe('setAuthenticated / setDfxAuthenticated', () => {
    it('flips the in-memory flag', () => {
      useAuthStore.getState().setAuthenticated(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      useAuthStore.getState().setDfxAuthenticated(true);
      expect(useAuthStore.getState().isDfxAuthenticated).toBe(true);
    });
  });

  describe('setOnboarded', () => {
    it('persists to secureStorage and updates state', async () => {
      await useAuthStore.getState().setOnboarded(true);
      expect(setItemMock).toHaveBeenCalledWith('isOnboarded', 'true', {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('rejects without flipping state when secureStorage write fails', async () => {
      setItemMock.mockRejectedValueOnce(new Error('keychain unavailable'));
      await expect(useAuthStore.getState().setOnboarded(true)).rejects.toThrow(
        'keychain unavailable',
      );
      expect(useAuthStore.getState().isOnboarded).toBe(false);
    });
  });

  describe('setPin', () => {
    it('persists hashed PIN and stores hash in memory', async () => {
      await useAuthStore.getState().setPin('123456');
      expect(setItemMock).toHaveBeenCalledTimes(1);
      const [key, hash] = setItemMock.mock.calls[0];
      expect(key).toBe('pinHash');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(useAuthStore.getState().pinHash).toBe(hash);
    });

    it('uses a fresh salt for the same PIN', async () => {
      await useAuthStore.getState().setPin('123456');
      const first = useAuthStore.getState().pinHash;
      useAuthStore.getState().setAuthenticated(true);
      await useAuthStore.getState().setPin('123456');
      const second = useAuthStore.getState().pinHash;
      expect(first).not.toBe(second);
    });

    it('produces different hashes for different inputs', async () => {
      await useAuthStore.getState().setPin('123456');
      const a = useAuthStore.getState().pinHash;
      useAuthStore.getState().setAuthenticated(true);
      await useAuthStore.getState().setPin('654321');
      const b = useAuthStore.getState().pinHash;
      expect(a).not.toBe(b);
    });

    it('propagates secureStorage errors', async () => {
      setItemMock.mockRejectedValueOnce(new Error('disk full'));
      await expect(useAuthStore.getState().setPin('123456')).rejects.toThrow('disk full');
      expect(useAuthStore.getState().pinHash).toBeNull();
    });

    it('rejects overwriting an existing PIN while locked and leaves its hash unchanged', async () => {
      useAuthStore.setState({ pinHash: 'existing-hash', isAuthenticated: false });

      await expect(useAuthStore.getState().setPin('654321')).rejects.toBeInstanceOf(
        PinOverwriteNotAllowedError,
      );

      expect(useAuthStore.getState().pinHash).toBe('existing-hash');
      expect(setItemMock).not.toHaveBeenCalled();
    });

    it('allows an authenticated user to replace an existing PIN', async () => {
      useAuthStore.setState({ pinHash: 'existing-hash', isAuthenticated: true });

      await useAuthStore.getState().setPin('654321');

      expect(useAuthStore.getState().pinHash).not.toBe('existing-hash');
      expect(setItemMock).toHaveBeenCalledWith('pinHash', expect.any(String), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    });
  });

  describe('verifyPin', () => {
    it('returns false when no pinHash is set', async () => {
      const ok = await useAuthStore.getState().verifyPin('123456');
      expect(ok).toBe(false);
    });

    it('returns true for the correct PIN', async () => {
      await useAuthStore.getState().setPin('123456');
      const ok = await useAuthStore.getState().verifyPin('123456');
      expect(ok).toBe(true);
    });

    it('returns false for an incorrect PIN', async () => {
      await useAuthStore.getState().setPin('123456');
      const ok = await useAuthStore.getState().verifyPin('999999');
      expect(ok).toBe(false);
      expect(useAuthStore.getState().failedAttempts).toBe(1);
      expect(setItemMock).toHaveBeenCalledWith('pinFailedAttempts', '1', {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    });

    it('does not calculate a hash while a persisted lockout is active', async () => {
      useAuthStore.setState({
        pinHash: 'stored-hash',
        failedAttempts: 5,
        lockedUntil: Date.now() + 30_000,
      });

      await expect(useAuthStore.getState().verifyPin('123456')).resolves.toBe(false);

      expect(verifyPinHashMock).not.toHaveBeenCalled();
    });

    it('clears persisted failures and lockout after a successful verification', async () => {
      await useAuthStore.getState().setPin('123456');
      useAuthStore.setState({ failedAttempts: 4, lockedUntil: Date.now() - 1 });
      deleteItemMock.mockClear();

      await expect(useAuthStore.getState().verifyPin('123456')).resolves.toBe(true);

      expect(deleteItemMock).toHaveBeenCalledWith('pinFailedAttempts');
      expect(deleteItemMock).toHaveBeenCalledWith('pinLockedUntil');
      expect(useAuthStore.getState().failedAttempts).toBe(0);
      expect(useAuthStore.getState().lockedUntil).toBeNull();
    });

    it('migrates a valid legacy PIN hash after successful verification', async () => {
      const legacyHash = await legacyHashPin('123456');
      useAuthStore.setState({ pinHash: legacyHash });

      const ok = await useAuthStore.getState().verifyPin('123456');

      expect(ok).toBe(true);
      await waitFor(() =>
        expect(setItemMock).toHaveBeenCalledWith(
          'pinHash',
          expect.stringMatching(/^pin\$argon2id\$/),
          { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
        ),
      );
      await waitFor(() =>
        expect(useAuthStore.getState().pinHash).toBe(setItemMock.mock.calls.at(-1)?.[1]),
      );
    });
  });

  describe('hydrate', () => {
    it('reads all auth keys and reflects them in state', async () => {
      getItemMock.mockImplementation(async (key: string) => {
        if (key === 'pinHash') return 'stored-hash';
        if (key === 'isOnboarded') return 'true';
        if (key === 'dfxAuthToken') return 'jwt';
        if (key === 'biometricEnabled') return 'true';
        if (key === 'pinFailedAttempts') return '6';
        if (key === 'pinLockedUntil') return '123456';
        return null;
      });

      await useAuthStore.getState().hydrate();

      const s = useAuthStore.getState();
      expect(s.pinHash).toBe('stored-hash');
      expect(s.isOnboarded).toBe(true);
      expect(s.isDfxAuthenticated).toBe(true);
      expect(s.biometricEnabled).toBe(true);
      expect(s.failedAttempts).toBe(6);
      expect(s.lockedUntil).toBe(123456);
      expect(s.isHydrated).toBe(true);
    });

    it('restores a persisted failed-attempt counter and lockout on a later hydrate', async () => {
      const persisted: Record<string, string> = { pinHash: 'invalid-hash' };
      setItemMock.mockImplementation(async (key: string, value: string) => {
        persisted[key] = value;
      });
      deleteItemMock.mockImplementation(async (key: string) => {
        delete persisted[key];
      });
      getItemMock.mockImplementation(async (key: string) => persisted[key] ?? null);
      useAuthStore.setState({ pinHash: persisted.pinHash ?? null });
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

      for (let attempt = 0; attempt < 5; attempt++) {
        await useAuthStore.getState().verifyPin('999999');
      }
      const persistedLockout = Number(persisted.pinLockedUntil);
      expect(persistedLockout).toBe(1_030_000);
      useAuthStore.setState({ failedAttempts: 0, lockedUntil: null });

      await useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().failedAttempts).toBe(5);
      expect(useAuthStore.getState().lockedUntil).toBe(persistedLockout);
      expect(useAuthStore.getState().pinHash).toBe('invalid-hash');
      nowSpy.mockRestore();
    });

    it('treats absent keys as not-onboarded / not-authenticated', async () => {
      await useAuthStore.getState().hydrate();
      const s = useAuthStore.getState();
      expect(s.pinHash).toBeNull();
      expect(s.isOnboarded).toBe(false);
      expect(s.isDfxAuthenticated).toBe(false);
      expect(s.biometricEnabled).toBe(false);
      expect(s.isHydrated).toBe(true);
    });

    it('treats isOnboarded=="false" string as false', async () => {
      getItemMock.mockImplementation(async (key: string) => {
        if (key === 'isOnboarded') return 'false';
        return null;
      });
      await useAuthStore.getState().hydrate();
      expect(useAuthStore.getState().isOnboarded).toBe(false);
    });

    it('rearms dfxAuthService with the stored JWT so cold-start linkAddress works', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { dfxAuthService } = require('../../src/features/dfx-backend/services');
      getItemMock.mockImplementation(async (key: string) =>
        key === 'dfxAuthToken' ? 'jwt-from-keychain' : null,
      );

      await useAuthStore.getState().hydrate();

      // Without this `adoptStoredToken` step, `linkAddress` would throw
      // "Not authenticated" on first post-boot use even though dfxApi has
      // the bearer header set.
      expect(dfxAuthService.getAccessToken()).toBe('jwt-from-keychain');
      expect(dfxAuthService.isAuthenticated()).toBe(true);
    });

    it('clears the dfxAuthService token when no JWT is stored', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { dfxAuthService } = require('../../src/features/dfx-backend/services');
      dfxAuthService.adoptStoredToken('residual');

      await useAuthStore.getState().hydrate();

      expect(dfxAuthService.getAccessToken()).toBeNull();
    });

    it('records a secure-storage hydration error and remains unhydrated', async () => {
      getItemMock.mockRejectedValueOnce(new Error('keychain unavailable'));

      await useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().hydrateError).toBe('keychain unavailable');
      expect(useAuthStore.getState().isHydrated).toBe(false);
    });
  });

  describe('reset', () => {
    it('removes all secure-storage keys and clears state', async () => {
      const clearAuthToken = jest.spyOn(dfxApi, 'clearAuthToken');
      const adoptStoredToken = jest.spyOn(dfxAuthService, 'adoptStoredToken');
      dfxAuthService.adoptStoredToken('residual-token');
      clearAuthToken.mockClear();
      adoptStoredToken.mockClear();
      useAuthStore.setState({
        isOnboarded: true,
        isAuthenticated: true,
        isDfxAuthenticated: true,
        biometricEnabled: true,
        pinHash: 'hash',
        failedAttempts: 7,
        lockedUntil: 123456,
        hydrateError: 'stale error',
      });

      await useAuthStore.getState().reset();

      expect(clearAuthToken).toHaveBeenCalledTimes(1);
      expect(adoptStoredToken).toHaveBeenCalledWith(null);
      expect(deleteItemMock).toHaveBeenCalledWith('accounts');
      expect(deleteItemMock).toHaveBeenCalledWith('dfxLinkedChains');
      expect(deleteItemMock).toHaveBeenCalledWith('pinHash');
      expect(deleteItemMock).toHaveBeenCalledWith('isOnboarded');
      expect(deleteItemMock).toHaveBeenCalledWith('encryptedSeed');
      expect(deleteItemMock).toHaveBeenCalledWith('dfxAuthToken');
      expect(deleteItemMock).toHaveBeenCalledWith('walletOrigin');
      expect(deleteItemMock).toHaveBeenCalledWith('passkeyCredentialId');
      expect(deleteItemMock).toHaveBeenCalledWith('passkeyDerivationVersion');
      expect(deleteItemMock).toHaveBeenCalledWith('pinFailedAttempts');
      expect(deleteItemMock).toHaveBeenCalledWith('pinLockedUntil');
      expect(deleteItemMock).toHaveBeenCalledWith('walletType');
      expect(deleteItemMock).toHaveBeenCalledWith('biometricEnabled');

      const s = useAuthStore.getState();
      expect(s.isOnboarded).toBe(false);
      expect(s.isAuthenticated).toBe(false);
      expect(s.isDfxAuthenticated).toBe(false);
      expect(s.biometricEnabled).toBe(false);
      expect(s.pinHash).toBeNull();
      expect(s.failedAttempts).toBe(0);
      expect(s.lockedUntil).toBeNull();
      expect(s.hydrateError).toBeNull();
    });

    it('clears in-memory auth and continues cleanup when one storage removal fails', async () => {
      const removalError = new Error('keychain unavailable');
      const clearAuthToken = jest.spyOn(dfxApi, 'clearAuthToken');
      const adoptStoredToken = jest.spyOn(dfxAuthService, 'adoptStoredToken');
      dfxAuthService.adoptStoredToken('residual-token');
      clearAuthToken.mockClear();
      adoptStoredToken.mockClear();
      deleteItemMock.mockImplementation(async (key: string) => {
        if (key === 'pinHash') throw removalError;
      });
      useAuthStore.setState({
        isOnboarded: true,
        isAuthenticated: true,
        isDfxAuthenticated: true,
        biometricEnabled: true,
        pinHash: 'hash',
        failedAttempts: 7,
        lockedUntil: 123456,
      });

      let thrown: unknown;
      try {
        await useAuthStore.getState().reset();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([removalError]);
      expect(deleteItemMock).toHaveBeenCalledWith('walletType');
      expect(deleteItemMock).toHaveBeenCalledWith('biometricEnabled');
      expect(clearAuthToken).toHaveBeenCalledTimes(1);
      expect(adoptStoredToken).toHaveBeenCalledWith(null);
      expect(dfxAuthService.getAccessToken()).toBeNull();
      expect(useAuthStore.getState()).toMatchObject({
        isOnboarded: false,
        isAuthenticated: false,
        isDfxAuthenticated: false,
        biometricEnabled: false,
        pinHash: null,
        failedAttempts: 0,
        lockedUntil: null,
      });
    });
  });

  describe('authenticateBiometric', () => {
    it('returns false when biometric is disabled, without calling the OS', async () => {
      useAuthStore.setState({ biometricEnabled: false });
      const ok = await useAuthStore.getState().authenticateBiometric(biometricOptions);
      expect(ok).toBe(false);
      expect(hasHardwareMock).not.toHaveBeenCalled();
      expect(authenticateMock).not.toHaveBeenCalled();
    });

    it('returns false when biometric is enabled but no hardware is available', async () => {
      useAuthStore.setState({ biometricEnabled: true });
      hasHardwareMock.mockResolvedValueOnce(false);
      const ok = await useAuthStore.getState().authenticateBiometric(biometricOptions);
      expect(ok).toBe(false);
      expect(authenticateMock).not.toHaveBeenCalled();
    });

    it('returns false when no biometric is enrolled', async () => {
      useAuthStore.setState({ biometricEnabled: true });
      isEnrolledMock.mockResolvedValueOnce(false);
      const ok = await useAuthStore.getState().authenticateBiometric(biometricOptions);
      expect(ok).toBe(false);
      expect(authenticateMock).not.toHaveBeenCalled();
    });

    it('returns true when the OS authentication prompt succeeds', async () => {
      useAuthStore.setState({ biometricEnabled: true });
      authenticateMock.mockResolvedValueOnce({ success: true });
      const ok = await useAuthStore.getState().authenticateBiometric(biometricOptions);
      expect(ok).toBe(true);
      expect(authenticateMock).toHaveBeenCalledTimes(1);
      expect(authenticateMock).toHaveBeenCalledWith({
        ...biometricOptions,
        biometricsSecurityLevel: 'strong',
        disableDeviceFallback: true,
      });
    });

    it('returns false when the OS authentication prompt is cancelled', async () => {
      useAuthStore.setState({ biometricEnabled: true });
      authenticateMock.mockResolvedValueOnce({ success: false });
      const ok = await useAuthStore.getState().authenticateBiometric(biometricOptions);
      expect(ok).toBe(false);
    });
  });

  describe('setBiometricEnabled', () => {
    it('persists "true" and updates state when hardware is available', async () => {
      await useAuthStore.getState().setBiometricEnabled(true);
      expect(setItemMock).toHaveBeenCalledWith('biometricEnabled', 'true', {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      expect(useAuthStore.getState().biometricEnabled).toBe(true);
    });

    it('still persists the preference when enabling without enrolled hardware (lock-screen falls back to PIN)', async () => {
      hasHardwareMock.mockResolvedValueOnce(false);
      await useAuthStore.getState().setBiometricEnabled(true);
      expect(setItemMock).toHaveBeenCalledWith('biometricEnabled', 'true', {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      expect(useAuthStore.getState().biometricEnabled).toBe(true);
    });

    it('persists "false" without checking hardware when disabling', async () => {
      useAuthStore.setState({ biometricEnabled: true });
      await useAuthStore.getState().setBiometricEnabled(false);
      expect(setItemMock).toHaveBeenCalledWith('biometricEnabled', 'false', {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      expect(useAuthStore.getState().biometricEnabled).toBe(false);
    });

    it('propagates secureStorage rejection without flipping state', async () => {
      setItemMock.mockRejectedValueOnce(new Error('keychain locked'));
      await expect(useAuthStore.getState().setBiometricEnabled(true)).rejects.toThrow(
        'keychain locked',
      );
      expect(useAuthStore.getState().biometricEnabled).toBe(false);
    });
  });
});

describe('useAuthStore (biometric + DFX backend OFF — MVP build)', () => {
  it('authenticateBiometric short-circuits to false when the biometric module is absent', async () => {
    // Re-require the store with FEATURES.BIOMETRIC disabled so the
    // `require('@/features/biometric/biometric')` is replaced with
    // null. This validates the MVP-mode build behaviour where the
    // module is not bundled at all.
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/config/features', () => ({
        FEATURES: { BIOMETRIC: false, DFX_BACKEND: false },
      }));
      const mod = await import('../../src/store/auth');
      const ok = await mod.useAuthStore.getState().authenticateBiometric(biometricOptions);
      expect(ok).toBe(false);
    });
  });

  it('hydrate() skips the DFX token rearm path when the DFX module is absent', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/config/features', () => ({
        FEATURES: { BIOMETRIC: false, DFX_BACKEND: false },
      }));
      const mod = await import('../../src/store/auth');
      // Should complete without touching any DFX module (none is loaded).
      await mod.useAuthStore.getState().hydrate();
      expect(mod.useAuthStore.getState().isHydrated).toBe(true);
    });
  });
});
