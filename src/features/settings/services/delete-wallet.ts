export type DeleteWalletResult = 'cancelled' | 'deleted' | 'deleted-with-cleanup-error' | 'failed';

type DeleteWalletDependencies = {
  requestReauth: () => Promise<boolean>;
  deleteWallet: () => Promise<void>;
  walletExists: () => Promise<boolean>;
  reset: () => Promise<void>;
};

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
  walletExists,
  reset,
}: DeleteWalletDependencies): Promise<DeleteWalletResult> {
  try {
    if (!(await requestReauth())) return 'cancelled';
  } catch {
    return 'failed';
  }

  try {
    await deleteWallet();
  } catch {
    try {
      if (await walletExists()) return 'failed';
    } catch {
      return 'failed';
    }
  }

  return resetAfterDeletion(reset);
}
