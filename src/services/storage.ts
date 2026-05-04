import * as SecureStore from 'expo-secure-store';

/**
 * Fast key-value storage for non-sensitive data.
 * Uses react-native-mmkv hooks in components.
 * For imperative access, use createMMKV() at runtime.
 */
export { useMMKV, useMMKVString, useMMKVBoolean } from 'react-native-mmkv';

/** Secure storage for sensitive data (PIN, encrypted seed) */
export const secureStorage = {
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

/** Storage keys */
export const StorageKeys = {
  IS_ONBOARDED: 'isOnboarded',
  PIN_HASH: 'pinHash',
  WALLET_TYPE: 'walletType',
  ENCRYPTED_SEED: 'encryptedSeed',
  SELECTED_CURRENCY: 'selectedCurrency',
  SELECTED_LANGUAGE: 'selectedLanguage',
  ACCOUNTS: 'accounts',
  DFX_AUTH_TOKEN: 'dfxAuthToken',
  WALLET_ORIGIN: 'walletOrigin',
  PASSKEY_CREDENTIAL_ID: 'passkeyCredentialId',
} as const;
