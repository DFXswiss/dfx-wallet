import * as SecureStore from 'expo-secure-store';
import { useWalletStore } from '../../src/store/wallet';

const setItemMock = SecureStore.setItemAsync as jest.Mock;
const getItemMock = SecureStore.getItemAsync as jest.Mock;
const deleteItemMock = SecureStore.deleteItemAsync as jest.Mock;

describe('WalletStore', () => {
  beforeEach(() => {
    setItemMock.mockReset();
    getItemMock.mockReset();
    deleteItemMock.mockReset();
    setItemMock.mockImplementation(async () => undefined);
    getItemMock.mockImplementation(async () => null);
    deleteItemMock.mockImplementation(async () => undefined);
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

  it('persists the currency pick to secure storage so it survives a relaunch', () => {
    useWalletStore.getState().setSelectedCurrency('EUR');
    expect(setItemMock).toHaveBeenCalledWith('selectedCurrency', 'EUR');
  });

  it('does NOT persist unknown currencies (in-memory only)', () => {
    useWalletStore.getState().setSelectedCurrency('XYZ');
    expect(setItemMock).not.toHaveBeenCalled();
    // …but the in-memory value still updates so the UI reflects intent.
    expect(useWalletStore.getState().selectedCurrency).toBe('XYZ');
  });

  it('hydrates from secureStorage on boot', async () => {
    getItemMock.mockImplementation(async (key: string) =>
      key === 'selectedCurrency' ? 'EUR' : null,
    );
    await useWalletStore.getState().hydrate();
    expect(useWalletStore.getState().selectedCurrency).toBe('EUR');
  });

  it('keeps the default when the stored currency is unrecognised', async () => {
    getItemMock.mockImplementation(async () => 'XYZ');
    await useWalletStore.getState().hydrate();
    expect(useWalletStore.getState().selectedCurrency).toBe('CHF');
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
