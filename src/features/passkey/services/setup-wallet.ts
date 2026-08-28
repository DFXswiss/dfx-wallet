import { deriveMnemonicFromPrf, DERIVATION_VERSION } from './key-derivation';
import { secureStorage, StorageKeys } from '@/services/storage';

/**
 * Derive mnemonic, initialize the WDK wallet, then persist passkey metadata.
 *
 * Order matters: initializeWallet() runs first so that a failure does not
 * leave orphaned storage keys. The passkey is already registered with the
 * OS at this point and cannot be rolled back, but at least the app state
 * stays clean if wallet creation fails.
 *
 * Shared by both the create-passkey and restore-passkey onboarding flows.
 */
export async function setupPasskeyWallet(
  prfOutput: Uint8Array,
  credentialId: string,
  initializeWallet: (mnemonic: string) => Promise<unknown>,
): Promise<void> {
  const mnemonic = deriveMnemonicFromPrf(prfOutput);

  await initializeWallet(mnemonic);

  await secureStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey');
  await secureStorage.set(StorageKeys.PASSKEY_CREDENTIAL_ID, credentialId);
  await secureStorage.set(StorageKeys.PASSKEY_DERIVATION_VERSION, String(DERIVATION_VERSION));
}
