import { deriveMnemonicFromPrf, DERIVATION_VERSION } from './key-derivation';
import { secureStorage, StorageKeys } from '@/services/storage';

/**
 * Derive the mnemonic, record whether a wallet already existed, read and
 * preserve the previous wallet origin, then mark passkey setup as pending
 * before initializing the WDK wallet. A failed origin read or a failed
 * pre-check aborts before the pending write. After a failed initialization,
 * the marker stays only if no wallet existed beforehand and the check sees
 * a wallet or cannot tell.
 * Otherwise the previous origin is restored or the marker is removed.
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
  const existedBefore = await walletExists();
  await secureStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey-pending');
  try {
    await initializeWallet(mnemonic);
  } catch (error) {
    let walletExistsNow = false;
    try {
      walletExistsNow = await walletExists();
    } catch {
      walletExistsNow = true;
    }
    if (existedBefore || !walletExistsNow) {
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
