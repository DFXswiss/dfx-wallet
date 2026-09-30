import {
  SEND_ASSETS,
  assetsForAddressKind,
  findSendAsset,
  pickDefaultAsset,
  resolveChain,
} from '@/features/transfer/assets';

const symbols = (assets: { symbol: string }[]) => assets.map((a) => a.symbol);

describe('SEND_ASSETS', () => {
  it('lists BTC, CHF, EUR, USD in that order', () => {
    expect(symbols(SEND_ASSETS)).toEqual(['BTC', 'CHF', 'EUR', 'USD']);
  });

  it('sends BTC over Spark and the stablecoins over the four EVM chains', () => {
    expect(findSendAsset('BTC')?.chains.map((c) => c.chain)).toEqual(['spark']);
    expect(findSendAsset('EUR')?.chains.map((c) => c.chain)).toEqual([
      'ethereum',
      'arbitrum',
      'polygon',
      'base',
    ]);
    expect(findSendAsset('XYZ')).toBeUndefined();
  });
});

describe('assetsForAddressKind', () => {
  it('offers only the stablecoins to an EVM address', () => {
    expect(symbols(assetsForAddressKind('evm'))).toEqual(['CHF', 'EUR', 'USD']);
  });

  it('offers only BTC to every other address', () => {
    expect(symbols(assetsForAddressKind('other'))).toEqual(['BTC']);
  });
});

describe('resolveChain', () => {
  const chf = findSendAsset('CHF')!;

  it('keeps a preferred chain the asset supports', () => {
    expect(resolveChain(chf, 'polygon')).toBe('polygon');
  });

  it('falls back to the first chain for an unsupported or missing preference', () => {
    expect(resolveChain(chf, 'spark')).toBe('ethereum');
    expect(resolveChain(chf)).toBe('ethereum');
    expect(resolveChain(findSendAsset('BTC')!, 'polygon')).toBe('spark');
  });
});

describe('pickDefaultAsset', () => {
  it('takes the first asset that has a balance', () => {
    const picked = pickDefaultAsset(SEND_ASSETS, (s) => s === 'EUR' || s === 'USD');
    expect(picked.symbol).toBe('EUR');
  });

  it('falls back to the first asset of the list', () => {
    expect(pickDefaultAsset(SEND_ASSETS, () => false).symbol).toBe('BTC');
    expect(pickDefaultAsset(assetsForAddressKind('evm'), () => false).symbol).toBe('CHF');
  });
});
