export type RestoreWalletFlowResult = 'cancelled' | 'restored';

type RestoreWalletFlowDependencies = {
  hasExistingWallet: boolean;
  hasWalletToDelete: boolean;
  confirm: () => Promise<boolean>;
  reset: () => Promise<void>;
  deleteWallet: () => Promise<void>;
  restoreWallet: () => Promise<unknown>;
};

function isWalletAlreadyExistsError(error: unknown): boolean {
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

  if (hasWalletToDelete) await deleteWallet();
  try {
    await restoreWallet();
  } catch (error) {
    if (!replacementConfirmed || !isWalletAlreadyExistsError(error)) throw error;
    await deleteWallet();
    await restoreWallet();
  }
  await reset();
  return 'restored';
}
