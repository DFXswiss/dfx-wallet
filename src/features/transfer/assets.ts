import type { ChainId } from '@/config/chains';
import type { AddressKind } from './address';

/**
 * What the send screen offers, grouped by canonical symbol: BTC goes out over
 * Spark, the fiat-pegged stablecoins over the four EVM chains. The concrete
 * token behind a symbol is resolved by `getSendAssetForCanonical`.
 */
export type SendAssetOption = {
  symbol: string;
  chains: { chain: ChainId; label: string }[];
};

const EVM_STABLE_CHAINS: SendAssetOption['chains'] = [
  { chain: 'ethereum', label: 'Ethereum' },
  { chain: 'arbitrum', label: 'Arbitrum' },
  { chain: 'polygon', label: 'Polygon' },
  { chain: 'base', label: 'Base' },
];

export const SEND_ASSETS: SendAssetOption[] = [
  {
    symbol: 'BTC',
    chains: [{ chain: 'spark', label: 'Bitcoin' }],
  },
  { symbol: 'CHF', chains: EVM_STABLE_CHAINS },
  { symbol: 'EUR', chains: EVM_STABLE_CHAINS },
  { symbol: 'USD', chains: EVM_STABLE_CHAINS },
];

export function findSendAsset(symbol: string): SendAssetOption | undefined {
  return SEND_ASSETS.find((asset) => asset.symbol === symbol);
}

/**
 * A 0x address can only receive the EVM stablecoins, every other address
 * format only Bitcoin — offering BTC to an EVM address (or the reverse) would
 * end in a failed send, so the asset list follows the recipient.
 */
export function assetsForAddressKind(kind: AddressKind): SendAssetOption[] {
  if (kind === 'evm') return SEND_ASSETS.filter((asset) => asset.symbol !== 'BTC');
  return SEND_ASSETS.filter((asset) => asset.symbol === 'BTC');
}

/** The preferred chain if the asset supports it, otherwise the asset's first chain. */
export function resolveChain(asset: SendAssetOption, preferred?: ChainId): ChainId {
  const match = preferred ? asset.chains.find((c) => c.chain === preferred) : undefined;
  // Every SEND_ASSETS entry lists at least one chain.
  return match ? match.chain : asset.chains[0]!.chain;
}

/**
 * First asset (in list order) whose balance is above zero, otherwise the first
 * asset of the list. `hasBalance` answers per symbol so the caller decides
 * where balances come from.
 */
export function pickDefaultAsset(
  candidates: SendAssetOption[],
  hasBalance: (symbol: string) => boolean,
): SendAssetOption {
  const funded = candidates.find((asset) => hasBalance(asset.symbol));
  // Callers only pass non-empty lists (see `assetsForAddressKind`).
  return funded ?? candidates[0]!;
}
