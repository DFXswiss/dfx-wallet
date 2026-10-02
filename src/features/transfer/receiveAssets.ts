import type { ChainId } from '@/config/chains';
import { FEATURES } from '@/config/features';

export type ReceiveAssetOption = {
  symbol: string;
  chains: { chain: ChainId; label: string }[];
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
    chains: [
      { chain: 'bitcoin', label: 'SegWit' },
      ...(FEATURES.DFX_BACKEND
        ? ([
            { chain: 'bitcoin-taproot', label: 'Taproot' },
            { chain: 'spark', label: 'Lightning' },
          ] as const)
        : []),
      { chain: 'ethereum', label: 'EVM' },
    ],
  },
  { symbol: 'CHF', chains: [{ chain: 'ethereum', label: 'Ethereum' }] },
  { symbol: 'EUR', chains: [{ chain: 'ethereum', label: 'Ethereum' }] },
  { symbol: 'USD', chains: [{ chain: 'ethereum', label: 'Ethereum' }] },
];
