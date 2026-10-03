import { deriveMnemonicFromPrf, DERIVATION_VERSION } from './key-derivation';
import { secureStorage, StorageKeys } from '@/services/storage';

/**
 * Derive the mnemonic, read and preserve the previous wallet origin, then mark
 * passkey setup as pending before initializing the WDK wallet. A failed origin
 * read aborts before mutation or initialization. If initialization fails with
 * no encrypted seed present, the previous origin is restored or the marker is
 * removed. A detected or unverifiable wallet keeps the pending marker.
 *
 * Order matters: an interrupted metadata write must stay fail-closed and
 * cannot be mistaken for a seed wallet.
 *
 * Shared by both the create-passkey and restore-passkey onboarding flows.
 */
export async function setupPasskeyWallet(
  prfOutput: Uint8Array,
  credentialId: string,
  initializeWallet: (mnemonic: string) => Promise<unknown>,
  walletExists: () => Promise<boolean> = async () => true,
): Promise<void> {
  const mnemonic = deriveMnemonicFromPrf(prfOutput);

  const previousOrigin = await secureStorage.get(StorageKeys.WALLET_ORIGIN);
  await secureStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey-pending');
  try {
    await initializeWallet(mnemonic);
  } catch (error) {
    let restorePreviousOrigin = false;
    try {
      restorePreviousOrigin = !(await walletExists());
    } catch {
      // Keep the pending marker when wallet persistence cannot be verified.
    }
    if (restorePreviousOrigin) {
      try {
        if (previousOrigin !== null) {
          await secureStorage.set(StorageKeys.WALLET_ORIGIN, previousOrigin);
        } else {
          await secureStorage.remove(StorageKeys.WALLET_ORIGIN);
        }
      } catch {
        // Preserve the initialization failure even if origin restoration fails.
      }
    }
    throw error;
  }

  await secureStorage.set(StorageKeys.PASSKEY_CREDENTIAL_ID, credentialId);
  await secureStorage.set(StorageKeys.PASSKEY_DERIVATION_VERSION, String(DERIVATION_VERSION));
  await secureStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey');
}
