import { FEATURES } from '../../src/config/features';
import { buildReceiveAssets } from '../../src/features/transfer/receiveAssets';
import { createReceivePresentation } from '../../src/features/transfer/useReceivePresentation';

const messages: Record<string, string> = {
  'receive.addressTitleBitcoin': 'Deine Bitcoin-Adresse',
  'receive.addressTitleNetwork': 'Deine {{asset}}-Adresse ({{network}})',
  'receive.buyAsset': '{{asset}} kaufen',
  'receive.networkCaptionInstant': 'sofort',
  'receive.networkCaptionLightningAddress': 'Lightning-Adresse',
  'receive.networkCaptionOnlyAsset': 'einziges Netz für {{asset}}',
  'receive.networkCaptionRecommended': 'empfohlen',
  'receive.networkCaptionWrappedBtc': 'als Wrapped BTC',
  'receive.networkNameBitcoin': 'Bitcoin',
  'receive.networkNameEthereum': 'Ethereum',
  'receive.networkNameLightning': 'Lightning',
  'receive.networkWarning':
    'Auf diese Adresse nur {{asset}} über {{network}} empfangen. Andere Coins gehen verloren.',
};

const translate = (key: string, values?: Record<string, string>): string => {
  let value = messages[key] ?? key;
  for (const [name, replacement] of Object.entries(values ?? {})) {
    value = value.replace(`{{${name}}}`, replacement);
  }
  return value;
};

describe('receive asset presentation', () => {
  it('builds all backend-enabled Bitcoin routes from one configuration', () => {
    const replacement = jest.replaceProperty(FEATURES, 'DFX_BACKEND', true);
    try {
      const bitcoin = buildReceiveAssets().find((asset) => asset.symbol === 'BTC')!;

      expect(bitcoin.chains.map((option) => option.chain)).toEqual([
        'bitcoin',
        'bitcoin-taproot',
        'spark',
        'ethereum',
      ]);
      expect(bitcoin.chains.map((option) => option.networkName)).toEqual([
        'receive.networkNameBitcoin',
        'receive.networkNameLightning',
        'receive.networkNameLightning',
        'receive.networkNameEthereum',
      ]);
      expect(bitcoin.chains.map((option) => option.caption)).toEqual([
        'receive.networkCaptionRecommended',
        'receive.networkCaptionLightningAddress',
        'receive.networkCaptionInstant',
        'receive.networkCaptionWrappedBtc',
      ]);
    } finally {
      replacement.restore();
    }
  });

  it('omits backend-only Bitcoin routes when DFX_BACKEND is disabled', () => {
    const replacement = jest.replaceProperty(FEATURES, 'DFX_BACKEND', false);
    try {
      const bitcoin = buildReceiveAssets().find((asset) => asset.symbol === 'BTC')!;
      expect(bitcoin.chains.map((option) => option.chain)).toEqual(['bitcoin', 'ethereum']);
    } finally {
      replacement.restore();
    }
  });

  it.each([
    ['bitcoin', 'Bitcoin'],
    ['bitcoin-taproot', 'Lightning'],
    ['spark', 'Lightning'],
    ['ethereum', 'Ethereum'],
  ] as const)('presents the Bitcoin warning network for %s', (chain, network) => {
    const bitcoin = createReceivePresentation(
      buildReceiveAssets(),
      'BTC',
      chain,
      'receive-address',
      translate,
    );

    expect(bitcoin.addressTitle).toBe('Deine Bitcoin-Adresse');
    expect(bitcoin.warningText).toBe(
      `Auf diese Adresse nur BTC über ${network} empfangen. Andere Coins gehen verloren.`,
    );
    expect(bitcoin.address).toBe('receive-address');
  });

  it('presents a stablecoin title, fixed bar caption and Ethereum warning', () => {
    const chf = createReceivePresentation(
      buildReceiveAssets(),
      'CHF',
      'ethereum',
      '0xaddress',
      translate,
    );

    expect(chf.addressTitle).toBe('Deine CHF-Adresse (Ethereum)');
    expect(chf.networks).toEqual([
      { key: 'ethereum', label: 'Ethereum', caption: 'einziges Netz für CHF' },
    ]);
    expect(chf.warningText).toBe(
      'Auf diese Adresse nur CHF über Ethereum empfangen. Andere Coins gehen verloren.',
    );
  });
});
