import { deriveMnemonicFromPrf, DERIVATION_VERSION } from './key-derivation';
import { secureStorage, StorageKeys } from '@/services/storage';

/**
 * Set up a passkey wallet and record its metadata.
 *
 * Steps: derive the mnemonic from the PRF output, read the previous wallet
 * origin, check whether a wallet already exists, write the `passkey-pending`
 * origin marker, then initialize the WDK wallet. A failed origin read or
 * existence check aborts before the marker is written.
 *
 * On success the credential id, the derivation version and the `passkey`
 * origin are stored.
 *
 * On a failed initialization the existence check runs again (a failing check
 * counts as "a wallet exists"). Cleanup is skipped only when no wallet
 * existed before and one exists now; then the marker stays, because a wallet
 * may exist with incomplete metadata. Otherwise the previous origin is
 * restored, or the marker removed when there was none. A cleanup error is
 * swallowed, which leaves the marker in place, so the initialization error is
 * always rethrown.
 *
 * Without an explicit `walletExists`, a wallet is assumed to exist, so a
 * failed initialization always attempts the cleanup.
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
