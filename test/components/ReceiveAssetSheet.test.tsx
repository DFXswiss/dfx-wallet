import { fireEvent, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { GlassListGroup } from '../../src/components/GlassListGroup';
import { ReceiveAssetSheet } from '../../src/features/buy-sell/ReceiveAssetSheet';
import type { BuyAsset } from '../../src/features/buy-sell/tradeCatalog';

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

// The sheet now renders `GlassSheet`/`GlassListGroup` for real — they need
// the actual theme tokens (`Card`, `Radius`, `useGlassRecipe`, …) instead of
// a hand-picked color subset.
jest.mock('@/theme', () => ({
  ...jest.requireActual('@/theme'),
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

  it('closes on backdrop press without selecting an asset', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <ReceiveAssetSheet
        visible
        onClose={onClose}
        assets={[BTC_ASSET]}
        selectedAssetSymbol="BTC"
        selectedChainIndex={0}
        onSelect={onSelect}
      />,
    );

    fireEvent.press(getByTestId('receive-asset-sheet-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders each asset section as a GlassListGroup', () => {
    const { UNSAFE_getAllByType } = render(
      <ReceiveAssetSheet
        visible
        onClose={jest.fn()}
        assets={[BTC_ASSET, USD_ASSET]}
        selectedAssetSymbol="BTC"
        selectedChainIndex={0}
        onSelect={jest.fn()}
      />,
    );

    expect(UNSAFE_getAllByType(GlassListGroup)).toHaveLength(2);
  });
});
