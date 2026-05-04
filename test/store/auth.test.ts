import { useAuthStore } from '../../src/store/auth';
import * as SecureStore from 'expo-secure-store';

const setItemMock = SecureStore.setItemAsync as jest.Mock;
const getItemMock = SecureStore.getItemAsync as jest.Mock;
const deleteItemMock = SecureStore.deleteItemAsync as jest.Mock;

const initialState = useAuthStore.getState();

beforeEach(() => {
  setItemMock.mockClear();
  getItemMock.mockClear();
  deleteItemMock.mockClear();
  setItemMock.mockImplementation(async () => undefined);
  getItemMock.mockImplementation(async () => null);
  deleteItemMock.mockImplementation(async () => undefined);
  useAuthStore.setState({ ...initialState }, true);
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
      expect(s.isHydrated).toBe(false);
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
      expect(setItemMock).toHaveBeenCalledWith('isOnboarded', 'true');
      expect(useAuthStore.getState().isOnboarded).toBe(true);
    });

    it('rejects without flipping state when secureStorage write fails', async () => {
      setItemMock.mockRejectedValueOnce(new Error('keychain unavailable'));
      await expect(useAuthStore.getState().setOnboarded(true)).rejects.toThrow('keychain unavailable');
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

    it('produces the same hash for the same input (deterministic)', async () => {
      await useAuthStore.getState().setPin('123456');
      const first = useAuthStore.getState().pinHash;
      await useAuthStore.getState().setPin('123456');
      const second = useAuthStore.getState().pinHash;
      expect(first).toBe(second);
    });

    it('produces different hashes for different inputs', async () => {
      await useAuthStore.getState().setPin('123456');
      const a = useAuthStore.getState().pinHash;
      await useAuthStore.getState().setPin('654321');
      const b = useAuthStore.getState().pinHash;
      expect(a).not.toBe(b);
    });

    it('propagates secureStorage errors', async () => {
      setItemMock.mockRejectedValueOnce(new Error('disk full'));
      await expect(useAuthStore.getState().setPin('123456')).rejects.toThrow('disk full');
      expect(useAuthStore.getState().pinHash).toBeNull();
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
    });
  });

  describe('hydrate', () => {
    it('reads four keys and reflects them in state', async () => {
      getItemMock.mockImplementation(async (key: string) => {
        if (key === 'pinHash') return 'stored-hash';
        if (key === 'isOnboarded') return 'true';
        if (key === 'dfxAuthToken') return 'jwt';
        if (key === 'biometricEnabled') return 'true';
        return null;
      });

      await useAuthStore.getState().hydrate();

      const s = useAuthStore.getState();
      expect(s.pinHash).toBe('stored-hash');
      expect(s.isOnboarded).toBe(true);
      expect(s.isDfxAuthenticated).toBe(true);
      expect(s.biometricEnabled).toBe(true);
      expect(s.isHydrated).toBe(true);
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
  });

  describe('reset', () => {
    it('removes all secure-storage keys and clears state', async () => {
      useAuthStore.setState({
        isOnboarded: true,
        isAuthenticated: true,
        isDfxAuthenticated: true,
        biometricEnabled: true,
        pinHash: 'hash',
      });

      await useAuthStore.getState().reset();

      expect(deleteItemMock).toHaveBeenCalledWith('pinHash');
      expect(deleteItemMock).toHaveBeenCalledWith('isOnboarded');
      expect(deleteItemMock).toHaveBeenCalledWith('encryptedSeed');
      expect(deleteItemMock).toHaveBeenCalledWith('dfxAuthToken');
      expect(deleteItemMock).toHaveBeenCalledWith('walletOrigin');
      expect(deleteItemMock).toHaveBeenCalledWith('passkeyCredentialId');
      expect(deleteItemMock).toHaveBeenCalledWith('passkeyDerivationVersion');
      expect(deleteItemMock).toHaveBeenCalledWith('biometricEnabled');

      const s = useAuthStore.getState();
      expect(s.isOnboarded).toBe(false);
      expect(s.isAuthenticated).toBe(false);
      expect(s.isDfxAuthenticated).toBe(false);
      expect(s.biometricEnabled).toBe(false);
      expect(s.pinHash).toBeNull();
    });
  });
});
