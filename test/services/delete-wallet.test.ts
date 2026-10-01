import { deleteWalletFlow } from '@/features/settings/services/delete-wallet';

function createDependencies() {
  return {
    requestReauth: jest.fn(async () => true),
    deleteWallet: jest.fn(async () => undefined),
    walletExists: jest.fn(async () => false),
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
    expect(dependencies.walletExists).not.toHaveBeenCalled();
    expect(dependencies.reset).toHaveBeenCalledTimes(1);
  });

  it('fails closed without resetting when deletion throws and the wallet remains', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockRejectedValueOnce(new Error('delete failed'));
    dependencies.walletExists.mockResolvedValueOnce(true);

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('failed');
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  it('resets when deletion throws after the wallet was actually removed', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockRejectedValueOnce(new Error('late failure'));
    dependencies.walletExists.mockResolvedValueOnce(false);

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('deleted');
    expect(dependencies.reset).toHaveBeenCalledTimes(1);
  });

  it('fails closed when checking wallet existence throws', async () => {
    const dependencies = createDependencies();
    dependencies.deleteWallet.mockRejectedValueOnce(new Error('delete failed'));
    dependencies.walletExists.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('failed');
    expect(dependencies.reset).not.toHaveBeenCalled();
  });

  it('reports failure when auth reset fails after deletion', async () => {
    const dependencies = createDependencies();
    dependencies.reset.mockRejectedValueOnce(new Error('keychain unavailable'));

    await expect(deleteWalletFlow(dependencies)).resolves.toBe('failed');
  });
});
