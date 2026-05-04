import { deriveMnemonicFromPrf, DERIVATION_VERSION } from './key-derivation';
import { secureStorage, StorageKeys } from '@/services/storage';

/**
 * Persist passkey metadata and initialize the WDK wallet from a PRF output.
 *
 * Shared by both the create-passkey and restore-passkey onboarding flows.
 */
export async function setupPasskeyWallet(
  prfOutput: Uint8Array,
  credentialId: string,
  createWallet: (opts: { name: string; mnemonic?: string }) => Promise<unknown>,
): Promise<void> {
  const mnemonic = deriveMnemonicFromPrf(prfOutput);

  await secureStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey');
  await secureStorage.set(StorageKeys.PASSKEY_CREDENTIAL_ID, credentialId);
  await secureStorage.set(StorageKeys.PASSKEY_DERIVATION_VERSION, String(DERIVATION_VERSION));
  await createWallet({ name: 'DFX Wallet', mnemonic });
}
