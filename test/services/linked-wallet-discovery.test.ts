import {
  calculateDiscoveredFiatValue,
  createDiscoveredAsset,
} from '@/features/linked-wallets/useLinkedWalletDiscovery';

describe('linked-wallet asset pricing', () => {
  it('keeps an unpriced positive balance representable with a null fiat value', () => {
    expect(calculateDiscoveredFiatValue(12.5, undefined)).toBeNull();
    expect(calculateDiscoveredFiatValue(12.5, 0)).toBeNull();
  });

  it('calculates fiat only when a positive price is available', () => {
    expect(calculateDiscoveredFiatValue(2, 125)).toBe(250);
  });

  it('keeps a positive token balance when its CoinGecko id or price is missing', () => {
    expect(
      createDiscoveredAsset({
        chain: 'ethereum',
        symbol: 'UNKNOWN',
        name: 'Unknown token',
        contract: '0x0000000000000000000000000000000000000001',
        rawBalance: '12500000',
        decimals: 6,
      }),
    ).toMatchObject({ balance: 12.5, fiatValue: null });
  });
});
