import { useWalletStore } from '../../src/store/wallet';

describe('WalletStore', () => {
  beforeEach(() => {
    useWalletStore.getState().reset();
  });

  it('should have correct initial state', () => {
    const state = useWalletStore.getState();

    expect(state.walletType).toBeNull();
    expect(state.accounts).toEqual([]);
    expect(state.assets).toEqual([]);
    expect(state.totalBalanceFiat).toBe('0.00');
    expect(state.selectedCurrency).toBe('CHF');
    expect(state.isLoading).toBe(false);
  });

  it('should set wallet type', () => {
    useWalletStore.getState().setWalletType('software');
    expect(useWalletStore.getState().walletType).toBe('software');
  });

  it('should add accounts', () => {
    const account = {
      chain: 'ethereum' as const,
      address: '0x123',
      derivationPath: "m/44'/60'/0'/0/0",
    };

    useWalletStore.getState().addAccount(account);
    expect(useWalletStore.getState().accounts).toHaveLength(1);
    expect(useWalletStore.getState().accounts[0]).toEqual(account);
  });

  it('should get account for chain', () => {
    const ethAccount = {
      chain: 'ethereum' as const,
      address: '0xeth',
      derivationPath: "m/44'/60'/0'/0/0",
    };
    const btcAccount = {
      chain: 'bitcoin' as const,
      address: 'bc1abc',
      derivationPath: "m/84'/0'/0'/0/0",
    };

    useWalletStore.getState().setAccounts([ethAccount, btcAccount]);

    expect(useWalletStore.getState().getAccountForChain('ethereum')).toEqual(ethAccount);
    expect(useWalletStore.getState().getAccountForChain('bitcoin')).toEqual(btcAccount);
    expect(useWalletStore.getState().getAccountForChain('polygon')).toBeUndefined();
  });

  it('should set assets and total balance', () => {
    const assets = [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        chain: 'ethereum' as const,
        balance: '1.5',
        balanceFiat: '3000.00',
        decimals: 18,
      },
    ];

    useWalletStore.getState().setAssets(assets);
    useWalletStore.getState().setTotalBalanceFiat('3000.00');

    expect(useWalletStore.getState().assets).toEqual(assets);
    expect(useWalletStore.getState().totalBalanceFiat).toBe('3000.00');
  });

  it('should reset state', () => {
    useWalletStore.getState().setWalletType('software');
    useWalletStore.getState().setTotalBalanceFiat('5000.00');

    useWalletStore.getState().reset();

    expect(useWalletStore.getState().walletType).toBeNull();
    expect(useWalletStore.getState().totalBalanceFiat).toBe('0.00');
  });
});
