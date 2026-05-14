import {
  getAssetMeta,
  getAssets,
  getAssetsForCanonicalSymbol,
  getCanonicalForSymbol,
  getCanonicalNameForSymbol,
  getCategoryForAsset,
  getCategoryForCanonicalSymbol,
  getNativeAsset,
  ALWAYS_ON_CHAINS,
  SELECTABLE_CHAINS,
  DEFAULT_ENABLED_CHAINS,
} from '../../src/config/tokens';

describe('getAssets', () => {
  it('returns the full asset list when called without a chain filter', () => {
    const all = getAssets();
    expect(all.length).toBeGreaterThan(0);
    // Bitcoin native always present.
    expect(all.some((a) => a.getId() === 'bitcoin-native')).toBe(true);
    // Ethereum native + at least one stablecoin on Ethereum.
    expect(all.some((a) => a.getId() === 'ethereum-native')).toBe(true);
    expect(all.some((a) => a.getId().startsWith('ethereum-0x'))).toBe(true);
  });

  it('filters by chain when a chain list is given', () => {
    const onlyBitcoin = getAssets(['bitcoin']);
    expect(onlyBitcoin.length).toBeGreaterThan(0);
    expect(onlyBitcoin.every((a) => a.getId().startsWith('bitcoin-'))).toBe(true);

    const arbitrumOnly = getAssets(['arbitrum']);
    expect(arbitrumOnly.every((a) => a.getId().startsWith('arbitrum-'))).toBe(true);
  });

  it('returns an empty list when the chain filter matches nothing', () => {
    expect(getAssets([])).toEqual([]);
  });
});

describe('getAssetMeta', () => {
  it('returns the metadata for a known asset id', () => {
    const meta = getAssetMeta('bitcoin-native');
    expect(meta).toBeDefined();
    expect(meta?.network).toBe('bitcoin');
    expect(meta?.isNative).toBe(true);
    expect(meta?.canonicalSymbol).toBe('BTC');
  });

  it('returns undefined for an unknown id', () => {
    expect(getAssetMeta('not-a-token')).toBeUndefined();
    expect(getAssetMeta('')).toBeUndefined();
  });
});

describe('getAssetsForCanonicalSymbol', () => {
  it('returns every asset that maps to a canonical symbol', () => {
    const usds = getAssetsForCanonicalSymbol('USD');
    expect(usds.length).toBeGreaterThan(0);
    expect(usds.every((m) => m.canonicalSymbol === 'USD')).toBe(true);
  });

  it('respects the chain filter', () => {
    const usdsOnEth = getAssetsForCanonicalSymbol('USD', ['ethereum']);
    expect(usdsOnEth.every((m) => m.network === 'ethereum')).toBe(true);
  });

  it('returns [] for an unknown canonical symbol', () => {
    expect(getAssetsForCanonicalSymbol('JPY')).toEqual([]);
  });
});

describe('getCanonicalForSymbol', () => {
  it('maps fiat tickers to themselves', () => {
    expect(getCanonicalForSymbol('CHF')).toBe('CHF');
    expect(getCanonicalForSymbol('EUR')).toBe('EUR');
    expect(getCanonicalForSymbol('USD')).toBe('USD');
  });

  it('maps token symbols to their canonical group', () => {
    expect(getCanonicalForSymbol('USDT')).toBe('USD');
    expect(getCanonicalForSymbol('USDC')).toBe('USD');
    expect(getCanonicalForSymbol('WBTC')).toBe('BTC');
  });

  it('returns undefined for unknown symbols', () => {
    expect(getCanonicalForSymbol('XYZ')).toBeUndefined();
  });
});

describe('getCanonicalNameForSymbol', () => {
  it('returns the canonical name when the symbol is known', () => {
    expect(getCanonicalNameForSymbol('BTC')).toBe('Bitcoin');
    expect(getCanonicalNameForSymbol('USD')).toBe('Dollar');
  });

  it('falls back to the symbol itself for unknown canonicals', () => {
    expect(getCanonicalNameForSymbol('XYZ')).toBe('XYZ');
  });
});

describe('getCategoryForAsset / getCategoryForCanonicalSymbol', () => {
  it('classifies native BTC as "btc"', () => {
    expect(getCategoryForAsset('bitcoin-native')).toBe('btc');
  });

  it('classifies native ETH as "native"', () => {
    expect(getCategoryForAsset('ethereum-native')).toBe('native');
  });

  it('classifies USDT as a stablecoin', () => {
    expect(getCategoryForCanonicalSymbol('USD')).toBe('stablecoin');
  });

  it('falls back to "other" for an unknown id', () => {
    expect(getCategoryForAsset('unknown-id')).toBe('other');
    expect(getCategoryForCanonicalSymbol('JPY')).toBe('other');
  });
});

describe('getNativeAsset', () => {
  it('returns the IAsset for a chain that has a native token', () => {
    const eth = getNativeAsset('ethereum');
    expect(eth?.getId()).toBe('ethereum-native');
    const btc = getNativeAsset('bitcoin');
    expect(btc?.getId()).toBe('bitcoin-native');
  });

  it('returns undefined for an unknown network', () => {
    expect(getNativeAsset('not-a-chain')).toBeUndefined();
  });
});

describe('chain enable-lists', () => {
  it('always-on includes Bitcoin + Ethereum at minimum', () => {
    expect(ALWAYS_ON_CHAINS).toContain('bitcoin');
    expect(ALWAYS_ON_CHAINS).toContain('ethereum');
  });

  it('selectable chains are disjoint from always-on (each chain is either always-on or selectable)', () => {
    for (const chain of SELECTABLE_CHAINS) {
      expect(ALWAYS_ON_CHAINS).not.toContain(chain);
    }
  });

  it('default-enabled chains include all always-on chains', () => {
    for (const chain of ALWAYS_ON_CHAINS) {
      expect(DEFAULT_ENABLED_CHAINS).toContain(chain);
    }
  });
});
