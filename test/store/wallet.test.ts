import { useWalletStore } from '../../src/store/wallet';

describe('WalletStore', () => {
  beforeEach(() => {
    useWalletStore.getState().reset();
  });

  it('should have correct initial state', () => {
    const state = useWalletStore.getState();

    expect(state.walletType).toBeNull();
    expect(state.totalBalanceFiat).toBe('0.00');
    expect(state.selectedCurrency).toBe('CHF');
    expect(state.selectedChain).toBe('ethereum');
  });

  it('should set wallet type', () => {
    useWalletStore.getState().setWalletType('software');
    expect(useWalletStore.getState().walletType).toBe('software');
  });

  it('should set total balance fiat', () => {
    useWalletStore.getState().setTotalBalanceFiat('3000.00');
    expect(useWalletStore.getState().totalBalanceFiat).toBe('3000.00');
  });

  it('should set selected currency', () => {
    useWalletStore.getState().setSelectedCurrency('USD');
    expect(useWalletStore.getState().selectedCurrency).toBe('USD');
  });

  it('should set selected chain', () => {
    useWalletStore.getState().setSelectedChain('polygon');
    expect(useWalletStore.getState().selectedChain).toBe('polygon');
  });

  it('should reset state', () => {
    useWalletStore.getState().setWalletType('software');
    useWalletStore.getState().setTotalBalanceFiat('5000.00');

    useWalletStore.getState().reset();

    expect(useWalletStore.getState().walletType).toBeNull();
    expect(useWalletStore.getState().totalBalanceFiat).toBe('0.00');
  });
});
