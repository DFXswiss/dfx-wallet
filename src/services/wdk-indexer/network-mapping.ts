import type { ChainId } from '@/config/chains';

/**
 * Mapping from our internal `ChainId` to the WDK indexer's `blockchain` slug.
 *
 * Per the indexer docs the supported chains are:
 * `ethereum`, `arbitrum`, `polygon`, `plasma`, `sepolia`, `bitcoin`, `spark`,
 * `ton`, `tron`. We only ship the ones the wallet supports today.
 *
 * Source: https://docs.wdk.tether.io/tools/indexer-api
 */
export const chainIdToIndexerBlockchain = (chain: ChainId): string => {
  switch (chain) {
    case 'ethereum':
      return 'ethereum';
    case 'arbitrum':
      return 'arbitrum';
    case 'polygon':
      return 'polygon';
    case 'plasma':
      return 'plasma';
    case 'sepolia':
      return 'sepolia';
    case 'spark':
      return 'spark';
  }
};

/** Snapshot of the mapping for tooling that prefers a record over a function. */
export const CHAIN_TO_INDEXER_BLOCKCHAIN: Readonly<Record<ChainId, string>> = {
  ethereum: chainIdToIndexerBlockchain('ethereum'),
  arbitrum: chainIdToIndexerBlockchain('arbitrum'),
  polygon: chainIdToIndexerBlockchain('polygon'),
  plasma: chainIdToIndexerBlockchain('plasma'),
  sepolia: chainIdToIndexerBlockchain('sepolia'),
  spark: chainIdToIndexerBlockchain('spark'),
};
