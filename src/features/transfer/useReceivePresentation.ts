import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChainId } from '@/config/chains';
import {
  buildReceiveAssets,
  type ReceiveAssetOption,
  type ReceiveChainOption,
} from '@/features/transfer/receiveAssets';
import { useReceiveAddress } from '@/features/transfer/useReceiveAddress';

type Translate = (key: string, values?: Record<string, string>) => string;

export type ReceiveNetworkPresentation = {
  key: ChainId;
  label: string;
  caption: string;
};

export type ReceivePresentation = {
  assets: ReceiveAssetOption[];
  asset: ReceiveAssetOption;
  chain: ReceiveChainOption;
  buyTitle: string;
  networks: ReceiveNetworkPresentation[];
  addressTitle: string;
  warningText: string;
  address: string;
};

const resolveAsset = (assets: ReceiveAssetOption[], symbol: string): ReceiveAssetOption =>
  assets.find((asset) => asset.symbol === symbol) ??
  assets.find((asset) => asset.symbol === 'BTC') ??
  assets[0]!;

const resolveChain = (asset: ReceiveAssetOption, chain: ChainId): ReceiveChainOption =>
  asset.chains.find((option) => option.chain === chain) ?? asset.chains[0]!;

export function createReceivePresentation(
  assets: ReceiveAssetOption[],
  symbol: string,
  chain: ChainId,
  address: string,
  translate: Translate,
): ReceivePresentation {
  const asset = resolveAsset(assets, symbol);
  const selectedChain = resolveChain(asset, chain);
  const network = translate(selectedChain.networkName);

  return {
    assets,
    asset,
    chain: selectedChain,
    buyTitle: translate('receive.buyAsset', { asset: asset.symbol }),
    networks: asset.chains.map((option) => ({
      key: option.chain,
      label: option.label,
      caption: translate(option.caption, { asset: asset.symbol }),
    })),
    addressTitle: translate(asset.addressTitle, { asset: asset.symbol, network }),
    warningText: translate('receive.networkWarning', { asset: asset.symbol, network }),
    address,
  };
}

export function useReceivePresentation(symbol: string, chain: ChainId): ReceivePresentation {
  const { t } = useTranslation();
  const assets = useMemo(buildReceiveAssets, []);
  const asset = resolveAsset(assets, symbol);
  const selectedChain = resolveChain(asset, chain);
  const address = useReceiveAddress(selectedChain.chain);

  return useMemo(
    () =>
      createReceivePresentation(assets, symbol, chain, address, (key, values) =>
        values ? t(key, values) : t(key),
      ),
    [address, assets, chain, symbol, t],
  );
}
