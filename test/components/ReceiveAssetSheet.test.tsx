import { fireEvent, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { ReceiveAssetSheet } from '../../src/features/buy-sell/ReceiveAssetSheet';
import type { BuyAsset } from '../../src/features/buy-sell/BuyScreenImpl';

const MockText = Text;
const MockView = View;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => <MockView>{children}</MockView>,
  };
});

jest.mock('@/components', () => {
  return {
    Icon: ({ name }: { name: string }) => <MockText>{name}</MockText>,
  };
});

jest.mock('@/theme', () => ({
  Typography: {
    bodyLarge: {},
    bodyMedium: {},
    bodySmall: {},
    headlineSmall: {},
  },
  useColors: () => ({
    border: '#dddddd',
    primary: '#0066ff',
    primaryLight: '#e6f0ff',
    surface: '#ffffff',
    text: '#111111',
    textSecondary: '#555555',
    textTertiary: '#777777',
  }),
}));

const BTC_ASSET: BuyAsset = {
  symbol: 'BTC',
  label: 'Bitcoin',
  chains: [
    {
      chain: 'bitcoin',
      label: 'SegWit',
      blockchain: 'Bitcoin',
      tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
    },
    {
      chain: 'bitcoin-lightning',
      label: 'Lightning',
      blockchain: 'Lightning',
      tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
    },
  ],
};

const USD_ASSET: BuyAsset = {
  symbol: 'USD',
  label: 'US Dollar',
  chains: [
    {
      chain: 'ethereum',
      label: 'Ethereum',
      blockchain: 'Ethereum',
      tokens: [
        { assetSymbol: 'USDT', label: 'USDT' },
        { assetSymbol: 'USDC', label: 'USDC' },
      ],
    },
  ],
};

describe('ReceiveAssetSheet', () => {
  it('shows the BTC section and passes the selected chain index to the presenter', () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText } = render(
      <ReceiveAssetSheet
        visible
        onClose={jest.fn()}
        assets={[BTC_ASSET]}
        selectedAssetSymbol="BTC"
        selectedChainIndex={0}
        onSelect={onSelect}
      />,
    );

    expect(getByText('Bitcoin')).toBeTruthy();
    expect(getByText('SegWit')).toBeTruthy();
    expect(getByText('Lightning')).toBeTruthy();

    fireEvent.press(getByTestId('receive-asset-option-BTC-bitcoin-lightning'));

    expect(onSelect).toHaveBeenCalledWith(BTC_ASSET, 1, 0);
  });

  it('passes the selected token index for multi-token chains', () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText } = render(
      <ReceiveAssetSheet
        visible
        onClose={jest.fn()}
        assets={[USD_ASSET]}
        selectedAssetSymbol="USD"
        selectedChainIndex={0}
        selectedTokenIndex={1}
        onSelect={onSelect}
      />,
    );

    expect(getByText('USDT')).toBeTruthy();
    expect(getByText('USDC')).toBeTruthy();

    fireEvent.press(getByTestId('receive-asset-option-USD-ethereum-USDT'));
    expect(onSelect).toHaveBeenCalledWith(USD_ASSET, 0, 0);

    fireEvent.press(getByTestId('receive-asset-option-USD-ethereum-USDC'));
    expect(onSelect).toHaveBeenCalledWith(USD_ASSET, 0, 1);
  });

  it('keeps the backdrop outside the asset option subtree', () => {
    const { getByTestId } = render(
      <ReceiveAssetSheet
        visible
        onClose={jest.fn()}
        assets={[BTC_ASSET]}
        selectedAssetSymbol="BTC"
        selectedChainIndex={0}
        onSelect={jest.fn()}
      />,
    );

    const backdrop = getByTestId('receive-asset-sheet-backdrop');

    expect(
      backdrop.findAllByProps({ testID: 'receive-asset-option-BTC-bitcoin-lightning' }),
    ).toHaveLength(0);
  });
});
