import * as SecureStore from 'expo-secure-store';
import { secureStorage, StorageKeys } from '../../src/services/storage';

describe('StorageKeys', () => {
  it('exposes every key the rest of the app reads / writes', () => {
    expect(StorageKeys.IS_ONBOARDED).toBe('isOnboarded');
    expect(StorageKeys.PIN_HASH).toBe('pinHash');
    expect(StorageKeys.WALLET_TYPE).toBe('walletType');
    expect(StorageKeys.ENCRYPTED_SEED).toBe('encryptedSeed');
    expect(StorageKeys.SELECTED_CURRENCY).toBe('selectedCurrency');
    expect(StorageKeys.SELECTED_LANGUAGE).toBe('selectedLanguage');
    expect(StorageKeys.ACCOUNTS).toBe('accounts');
    expect(StorageKeys.DFX_AUTH_TOKEN).toBe('dfxAuthToken');
    expect(StorageKeys.DFX_LINKED_CHAINS).toBe('dfxLinkedChains');
    expect(StorageKeys.WALLET_ORIGIN).toBe('walletOrigin');
    expect(StorageKeys.PASSKEY_CREDENTIAL_ID).toBe('passkeyCredentialId');
    expect(StorageKeys.PASSKEY_DERIVATION_VERSION).toBe('passkeyDerivationVersion');
  });

  it('has unique values', () => {
    const values = Object.values(StorageKeys);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('secureStorage', () => {
  const setSpy = SecureStore.setItemAsync as jest.Mock;
  const getSpy = SecureStore.getItemAsync as jest.Mock;
  const delSpy = SecureStore.deleteItemAsync as jest.Mock;

  beforeEach(() => {
    setSpy.mockReset();
    getSpy.mockReset();
    delSpy.mockReset();
    setSpy.mockResolvedValue(undefined);
    getSpy.mockResolvedValue(null);
    delSpy.mockResolvedValue(undefined);
  });

  it('forwards `set` to expo-secure-store with the same key/value', async () => {
    await secureStorage.set('k', 'v');
    expect(setSpy).toHaveBeenCalledWith('k', 'v');
  });

  it('forwards `get` and returns the underlying value', async () => {
    getSpy.mockResolvedValueOnce('cached');
    await expect(secureStorage.get('k')).resolves.toBe('cached');
    expect(getSpy).toHaveBeenCalledWith('k');
  });

  it('returns null when the underlying store has no value', async () => {
    await expect(secureStorage.get('missing')).resolves.toBeNull();
  });

  it('forwards `remove` to deleteItemAsync', async () => {
    await secureStorage.remove('k');
    expect(delSpy).toHaveBeenCalledWith('k');
  });

  it('propagates errors from the underlying store on `set`', async () => {
    setSpy.mockRejectedValueOnce(new Error('keychain locked'));
    await expect(secureStorage.set('k', 'v')).rejects.toThrow('keychain locked');
  });
});
