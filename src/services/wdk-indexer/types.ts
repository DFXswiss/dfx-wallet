/**
 * Shapes for the WDK Indexer REST API.
 *
 * Source: https://docs.wdk.tether.io/tools/indexer-api/api-reference
 *
 * Field types are kept conservative because the indexer's published OpenAPI
 * spec exposes some fields as opaque strings (amounts, ids) — we don't want
 * the type system to lie about them being numbers.
 */

export interface IndexerConfig {
  baseUrl: string;
  apiKey: string;
}

export interface IndexerTokenBalance {
  amount: string;
  token: string;
  blockchain: string;
  address: string;
}

export interface IndexerTokenBalanceResponse {
  tokenBalance: IndexerTokenBalance;
}

export interface IndexerTokenTransfer {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  amount: string;
  token: string;
  blockchain: string;
  /** Whether the address argument was the sender (`out`) or recipient (`in`). */
  direction: 'in' | 'out';
}

export interface IndexerTokenTransfersResponse {
  tokenTransfers: IndexerTokenTransfer[];
}

export interface IndexerErrorResponse {
  error?: string;
  message?: string;
}
