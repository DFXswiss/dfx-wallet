export type RestoreWalletFlowResult = 'cancelled' | 'restored';

type RestoreWalletFlowDependencies = {
  hasExistingWallet: boolean;
  hasWalletToDelete: boolean;
  confirm: () => Promise<boolean>;
  reset: () => Promise<void>;
  deleteWallet: () => Promise<void>;
  restoreWallet: () => Promise<unknown>;
};

export function isWalletAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('already exists');
}

export async function restoreWalletFlow({
  hasExistingWallet,
  hasWalletToDelete,
  confirm,
  reset,
  deleteWallet,
  restoreWallet,
}: RestoreWalletFlowDependencies): Promise<RestoreWalletFlowResult> {
  const replacementConfirmed = hasExistingWallet ? await confirm() : false;
  if (hasExistingWallet && !replacementConfirmed) return 'cancelled';

  let walletWasDeleted = false;
  if (hasWalletToDelete) {
    await deleteWallet();
    walletWasDeleted = true;
  }
  try {
    try {
      await restoreWallet();
    } catch (error) {
      if (!replacementConfirmed || !isWalletAlreadyExistsError(error)) throw error;
      await deleteWallet();
      walletWasDeleted = true;
      await restoreWallet();
    }
  } catch (error) {
    if (walletWasDeleted) {
      try {
        await reset();
      } catch {
        // Preserve the restore failure that left the wallet unavailable.
      }
    }
    throw error;
  }
  await reset();
  return 'restored';
}
