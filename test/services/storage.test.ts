import { StorageKeys } from '../../src/services/storage';

describe('StorageKeys', () => {
  it('should have all required keys', () => {
    expect(StorageKeys.IS_ONBOARDED).toBe('isOnboarded');
    expect(StorageKeys.PIN_HASH).toBe('pinHash');
    expect(StorageKeys.WALLET_TYPE).toBe('walletType');
    expect(StorageKeys.ENCRYPTED_SEED).toBe('encryptedSeed');
    expect(StorageKeys.SELECTED_CURRENCY).toBe('selectedCurrency');
    expect(StorageKeys.SELECTED_LANGUAGE).toBe('selectedLanguage');
    expect(StorageKeys.ACCOUNTS).toBe('accounts');
    expect(StorageKeys.DFX_AUTH_TOKEN).toBe('dfxAuthToken');
  });

  it('should have unique values', () => {
    const values = Object.values(StorageKeys);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});
