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
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
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
  ACCOUNTS: 'accounts',
  DFX_AUTH_TOKEN: 'dfxAuthToken',
  /** JSON-encoded `{ [chain: string]: true }` — chains we've already attached
   *  to the active DFX account so we don't sign again on every relaunch. */
  DFX_LINKED_CHAINS: 'dfxLinkedChains',
  ENCRYPTED_SEED: 'encryptedSeed',
  IS_ONBOARDED: 'isOnboarded',
  PASSKEY_CREDENTIAL_ID: 'passkeyCredentialId',
  PASSKEY_DERIVATION_VERSION: 'passkeyDerivationVersion',
  PIN_FAILED_ATTEMPTS: 'pinFailedAttempts',
  PIN_HASH: 'pinHash',
  PIN_LOCKED_UNTIL: 'pinLockedUntil',
  SELECTED_CURRENCY: 'selectedCurrency',
  SELECTED_LANGUAGE: 'selectedLanguage',
  WALLET_ORIGIN: 'walletOrigin',
  WALLET_TYPE: 'walletType',
} as const;
