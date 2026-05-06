import type { IAsset } from '@tetherto/wdk-react-native-core';

export type IndexerTokenTransferQuery = {
  blockchain: string;
  token: string;
};

/**
 * Maps a wallet asset + on-chain address to WDK Indexer `token-transfers` path params.
 *
 * The indexer only exposes specific (blockchain, token) pairs — not native ETH/MATIC on
 * most EVM chains. See: https://docs.wdk.tether.io/tools/indexer-api
 *
 * `plasma` is omitted: the public API has rejected `blockchain=plasma` (invalid enum).
 *
 * Spark transfers require a Spark Bech32 address (`spark1…`); if the wallet still exposes
 * another format for `network === 'spark'`, we skip to avoid 400s from the indexer.
 */
export function getIndexerTokenTransferQuery(
  asset: IAsset,
  walletAddress: string,
): IndexerTokenTransferQuery | null {
  const network = asset.getNetwork();
  const symbol = asset.getSymbol().toUpperCase();

  if (network === 'spark' && symbol === 'BTC') {
    if (!walletAddress.startsWith('spark1')) return null;
    return { blockchain: 'spark', token: 'btc' };
  }

  if (network === 'plasma') return null;

  if (symbol === 'USDT') {
    if (network === 'ethereum' || network === 'arbitrum' || network === 'polygon' || network === 'sepolia') {
      return { blockchain: network, token: 'usdt' };
    }
    return null;
  }

  if (symbol === 'XAUT' && network === 'ethereum') {
    return { blockchain: 'ethereum', token: 'xaut' };
  }

  return null;
}
