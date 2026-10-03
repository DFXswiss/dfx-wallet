export type RestoreWalletFlowResult = 'cancelled' | 'restored';

type RemainingWalletItems = {
  key: boolean;
  seed: boolean;
  entropy: boolean;
};

type RestoreWalletFlowDependencies = {
  hasExistingWallet: boolean;
  hasWalletToDelete: boolean;
  confirm: () => Promise<boolean>;
  reset: () => Promise<void>;
  deleteWallet: () => Promise<void>;
  getRemainingWalletItems: () => Promise<RemainingWalletItems>;
  restoreWallet: () => Promise<unknown>;
};

type WalletDeletionResult =
  | { status: 'deleted' }
  | { status: 'failed' | 'partial'; error: unknown };

async function deleteWalletWithRetry(
  deleteWallet: () => Promise<void>,
  getRemainingWalletItems: () => Promise<RemainingWalletItems>,
): Promise<WalletDeletionResult> {
  try {
    await deleteWallet();
    return { status: 'deleted' };
  } catch {
    try {
      await deleteWallet();
      return { status: 'deleted' };
    } catch (error) {
      try {
        const remaining = await getRemainingWalletItems();
        if (remaining.key && remaining.seed && remaining.entropy) {
          return { status: 'failed', error };
        }
      } catch {
        // Only a verifiably intact wallet may retain app state after both attempts fail.
      }
      return { status: 'partial', error };
    }
  }
}

async function bestEffortReset(reset: () => Promise<void>): Promise<void> {
  try {
    await reset();
  } catch {
    // Preserve the failure that left the wallet unavailable.
  }
}

export function isWalletAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('already exists');
}

export async function restoreWalletFlow({
  hasExistingWallet,
  hasWalletToDelete,
  confirm,
  reset,
  deleteWallet,
  getRemainingWalletItems,
  restoreWallet,
}: RestoreWalletFlowDependencies): Promise<RestoreWalletFlowResult> {
  const replacementConfirmed = hasExistingWallet ? await confirm() : false;
  if (hasExistingWallet && !replacementConfirmed) return 'cancelled';

  let walletWasDeleted = false;
  const deleteCurrentWallet = async (): Promise<void> => {
    const result = await deleteWalletWithRetry(deleteWallet, getRemainingWalletItems);
    if (result.status === 'failed') throw result.error;
    if (result.status === 'partial') {
      walletWasDeleted = false;
      await bestEffortReset(reset);
      throw result.error;
    }
    walletWasDeleted = true;
  };

  if (hasWalletToDelete) {
    await deleteCurrentWallet();
  }
  try {
    try {
      await restoreWallet();
    } catch (error) {
      if (!replacementConfirmed || !isWalletAlreadyExistsError(error)) throw error;
      await deleteCurrentWallet();
      await restoreWallet();
    }
  } catch (error) {
    if (walletWasDeleted) {
      await bestEffortReset(reset);
    }
    throw error;
  }
  await reset();
  return 'restored';
}
