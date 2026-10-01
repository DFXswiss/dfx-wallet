import { restoreWalletFlow } from '@/features/restore/services/restore-wallet';

function createDependencies() {
  const calls: string[] = [];
  return {
    calls,
    confirm: jest.fn(async () => {
      calls.push('confirm');
      return true;
    }),
    reset: jest.fn(async () => {
      calls.push('reset');
    }),
    deleteWallet: jest.fn(async () => {
      calls.push('delete');
    }),
    restoreWallet: jest.fn(async () => {
      calls.push('restore');
    }),
  };
}

describe('restoreWalletFlow', () => {
  it('restores and resets without confirmation when no wallet exists', async () => {
    const dependencies = createDependencies();
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: false,
        hasWalletToDelete: false,
      }),
    ).resolves.toBe('restored');

    expect(dependencies.confirm).not.toHaveBeenCalled();
    expect(dependencies.deleteWallet).not.toHaveBeenCalled();
    expect(dependencies.calls).toEqual(['restore', 'reset']);
  });

  it('cancels without changing anything when replacement is declined', async () => {
    const dependencies = createDependencies();
    dependencies.confirm.mockImplementationOnce(async () => {
      dependencies.calls.push('confirm');
      return false;
    });
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: true,
        hasWalletToDelete: true,
      }),
    ).resolves.toBe('cancelled');

    expect(dependencies.calls).toEqual(['confirm']);
  });

  it('confirms, deletes, restores, and resets in order', async () => {
    const dependencies = createDependencies();
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: true,
        hasWalletToDelete: true,
      }),
    ).resolves.toBe('restored');

    expect(dependencies.calls).toEqual(['confirm', 'delete', 'restore', 'reset']);
    expect(dependencies.deleteWallet).toHaveBeenCalledTimes(1);
  });

  it('deletes and retries exactly once for an already-existing wallet after confirmation', async () => {
    const dependencies = createDependencies();
    dependencies.restoreWallet
      .mockImplementationOnce(async () => {
        dependencies.calls.push('restore');
        throw new Error('Wallet ALREADY EXISTS for this identifier');
      })
      .mockImplementationOnce(async () => {
        dependencies.calls.push('restore');
      });
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: true,
        hasWalletToDelete: false,
      }),
    ).resolves.toBe('restored');

    expect(dependencies.calls).toEqual(['confirm', 'restore', 'delete', 'restore', 'reset']);
    expect(dependencies.restoreWallet).toHaveBeenCalledTimes(2);
  });

  it('propagates already-exists without confirmation, deletion, retry, or reset', async () => {
    const dependencies = createDependencies();
    dependencies.restoreWallet.mockRejectedValueOnce(new Error('Wallet already exists'));
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: false,
        hasWalletToDelete: false,
      }),
    ).rejects.toThrow('Wallet already exists');

    expect(dependencies.confirm).not.toHaveBeenCalled();
    expect(dependencies.deleteWallet).not.toHaveBeenCalled();
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  it('propagates unrelated restore failures without retrying or resetting', async () => {
    const dependencies = createDependencies();
    dependencies.restoreWallet.mockRejectedValueOnce(new Error('restore failed'));
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: true,
        hasWalletToDelete: false,
      }),
    ).rejects.toThrow('restore failed');

    expect(dependencies.restoreWallet).toHaveBeenCalledTimes(1);
    expect(dependencies.deleteWallet).not.toHaveBeenCalled();
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  it('leaves auth untouched when deleting the existing wallet fails', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockRejectedValueOnce(new Error('delete failed'));
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: true,
        hasWalletToDelete: true,
      }),
    ).rejects.toThrow('delete failed');

    expect(dependencies.restoreWallet).not.toHaveBeenCalled();
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  it('propagates a failed retry and does not reset auth', async () => {
    const dependencies = createDependencies();
    dependencies.restoreWallet
      .mockRejectedValueOnce(new Error('already exists'))
      .mockRejectedValueOnce(new Error('retry failed'));
    await expect(
      restoreWalletFlow({
        ...dependencies,
        hasExistingWallet: true,
        hasWalletToDelete: false,
      }),
    ).rejects.toThrow('retry failed');

    expect(dependencies.deleteWallet).toHaveBeenCalledTimes(1);
    expect(dependencies.restoreWallet).toHaveBeenCalledTimes(2);
    expect(dependencies.reset).not.toHaveBeenCalled();
  });
});
