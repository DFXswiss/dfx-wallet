import { deleteWalletFlow } from '@/features/settings/services/delete-wallet';

function createDependencies() {
  return {
    requestReauth: jest.fn(async () => true),
    deleteWallet: jest.fn(async () => undefined),
    getRemainingWalletItems: jest.fn(async () => ({ key: true, seed: true, entropy: true })),
    reset: jest.fn(async () => undefined),
  };
}

describe('deleteWalletFlow', () => {
  it('returns cancelled without deleting when reauthentication is declined', async () => {
    const dependencies = createDependencies();
    dependencies.requestReauth.mockResolvedValueOnce(false);

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('cancelled');
    expect(dependencies.deleteWallet).not.toHaveBeenCalled();
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  it('fails closed when reauthentication throws', async () => {
    const dependencies = createDependencies();
    dependencies.requestReauth.mockRejectedValueOnce(new Error('authentication unavailable'));

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('failed');
    expect(dependencies.deleteWallet).not.toHaveBeenCalled();
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  it('resets auth after a successful wallet deletion', async () => {
    const dependencies = createDependencies();

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('deleted');
    expect(dependencies.requestReauth).toHaveBeenCalledTimes(1);
    expect(dependencies.deleteWallet).toHaveBeenCalledTimes(1);
    expect(dependencies.getRemainingWalletItems).not.toHaveBeenCalled();
    expect(dependencies.reset).toHaveBeenCalledTimes(1);
  });

  // Red mutation: remove the retry or classify all remaining items as partial deletion.
  it('fails without resetting when both deletions throw and all wallet items remain', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockImplementation(async () => {
      throw new Error('delete failed');
    });

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('failed');
    expect(dependencies.deleteWallet).toHaveBeenCalledTimes(2);
    expect(dependencies.getRemainingWalletItems).toHaveBeenCalledTimes(1);
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  // Red mutations: omit the retry or classify partial deletion as a total failure.
  it('resets and reports cleanup failure when some wallet items were deleted', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockImplementation(async () => {
      throw new Error('partial delete');
    });
    dependencies.getRemainingWalletItems.mockResolvedValueOnce({
      key: true,
      seed: false,
      entropy: true,
    });

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('deleted-with-cleanup-error');
    expect(dependencies.deleteWallet).toHaveBeenCalledTimes(2);
    expect(dependencies.reset).toHaveBeenCalledTimes(1);
  });

  // Red mutation: omit the retry before inspecting the remaining items.
  it('continues as a normal deletion when the retry succeeds', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockImplementationOnce(async () => {
      throw new Error('first delete failed');
    });

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('deleted');
    expect(dependencies.deleteWallet).toHaveBeenCalledTimes(2);
    expect(dependencies.getRemainingWalletItems).not.toHaveBeenCalled();
    expect(dependencies.reset).toHaveBeenCalledTimes(1);
  });

  // Red mutation: classify an unverifiable deletion as a total failure.
  it('resets and reports cleanup failure when remaining-item inspection throws', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockImplementation(async () => {
      throw new Error('delete failed');
    });
    dependencies.getRemainingWalletItems.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('deleted-with-cleanup-error');
    expect(dependencies.deleteWallet).toHaveBeenCalledTimes(2);
    expect(dependencies.reset).toHaveBeenCalledTimes(1);
  });

  it('reports a deleted wallet with incomplete cleanup when auth reset fails', async () => {
    const dependencies = createDependencies();
    dependencies.reset.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('deleted-with-cleanup-error');
  });
});
