import type { ChainId } from '@/config/chains';
import { FEATURES } from '@/config/features';

export type ReceiveAssetOption = {
  symbol: string;
  addressTitle: string;
  chains: ReceiveChainOption[];
};

export type ReceiveChainOption = {
  chain: ChainId;
  label: string;
  caption: string;
  networkName: string;
};

/**
 * Bitcoin offers Native on-chain, DFX-managed Taproot/Lightning, and EVM
 * receive paths. Stablecoins use Ethereum directly. The backend-gated paths
 * are evaluated when this function is called so feature-flag changes between
 * mounts are reflected without duplicating the list in each receive surface.
 */
export const buildReceiveAssets = (): ReceiveAssetOption[] => [
  {
    symbol: 'BTC',
    addressTitle: 'receive.addressTitleBitcoin',
    chains: [
      {
        chain: 'bitcoin',
        label: 'Bitcoin',
        caption: 'receive.networkCaptionRecommended',
        networkName: 'receive.networkNameBitcoin',
      },
      ...(FEATURES.DFX_BACKEND
        ? ([
            {
              chain: 'bitcoin-taproot',
              label: 'Taproot',
              caption: 'receive.networkCaptionLightningAddress',
              networkName: 'receive.networkNameLightning',
            },
            {
              chain: 'spark',
              label: 'Lightning',
              caption: 'receive.networkCaptionInstant',
              networkName: 'receive.networkNameLightning',
            },
          ] as const)
        : []),
      {
        chain: 'ethereum',
        label: 'Ethereum',
        caption: 'receive.networkCaptionWrappedBtc',
        networkName: 'receive.networkNameEthereum',
      },
    ],
  },
  ...(['CHF', 'EUR', 'USD'] as const).map((symbol) => ({
    symbol,
    addressTitle: 'receive.addressTitleNetwork',
    chains: [
      {
        chain: 'ethereum' as const,
        label: 'Ethereum',
        caption: 'receive.networkCaptionOnlyAsset',
        networkName: 'receive.networkNameEthereum',
      },
    ],
  })),
];
