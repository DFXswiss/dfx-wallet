export type DeleteWalletResult = 'cancelled' | 'deleted' | 'deleted-with-cleanup-error' | 'failed';

type RemainingWalletItems = {
  key: boolean;
  seed: boolean;
  entropy: boolean;
};

type DeleteWalletDependencies = {
  requestReauth: () => Promise<boolean>;
  deleteWallet: () => Promise<void>;
  getRemainingWalletItems: () => Promise<RemainingWalletItems>;
  reset: () => Promise<void>;
};

type WalletDeletionStatus = 'deleted' | 'failed' | 'partial';

async function deleteWalletWithRetry(
  deleteWallet: () => Promise<void>,
  getRemainingWalletItems: () => Promise<RemainingWalletItems>,
): Promise<WalletDeletionStatus> {
  try {
    await deleteWallet();
    return 'deleted';
  } catch {
    try {
      await deleteWallet();
      return 'deleted';
    } catch {
      try {
        const remaining = await getRemainingWalletItems();
        if (remaining.key && remaining.seed && remaining.entropy) return 'failed';
      } catch {
        // Only a verifiably intact wallet may retain app state after both attempts fail.
      }
      return 'partial';
    }
  }
}

async function resetAfterDeletion(reset: () => Promise<void>): Promise<DeleteWalletResult> {
  try {
    await reset();
    return 'deleted';
  } catch {
    return 'deleted-with-cleanup-error';
  }
}

export async function deleteWalletFlow({
  requestReauth,
  deleteWallet,
  getRemainingWalletItems,
  reset,
}: DeleteWalletDependencies): Promise<DeleteWalletResult> {
  try {
    if (!(await requestReauth())) return 'cancelled';
  } catch {
    return 'failed';
  }

  const deletionStatus = await deleteWalletWithRetry(deleteWallet, getRemainingWalletItems);
  if (deletionStatus === 'failed') return 'failed';
  if (deletionStatus === 'partial') {
    await resetAfterDeletion(reset);
    return 'deleted-with-cleanup-error';
  }

  return resetAfterDeletion(reset);
}
