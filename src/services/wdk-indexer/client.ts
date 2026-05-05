import { getIndexerConfig } from './config';
import type {
  IndexerConfig,
  IndexerErrorResponse,
  IndexerTokenBalance,
  IndexerTokenBalanceResponse,
  IndexerTokenTransfer,
  IndexerTokenTransfersResponse,
} from './types';

export class WdkIndexerError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WdkIndexerError';
  }
}

interface QueryArgs {
  blockchain: string;
  /** Token slug, e.g. `'usdt'`, `'btc'`. Lowercased before being sent. */
  token: string;
  address: string;
}

/**
 * Thin REST client for the WDK Indexer.
 *
 * The published `@tetherto/wdk-indexer-http` SDK is GitHub-only (not on npm)
 * and the surface we need is small enough — two endpoints — that direct
 * `fetch` is simpler than vendoring the SDK.
 *
 * Endpoints:
 * - `GET /api/v1/{blockchain}/{token}/{address}/token-balances`
 * - `GET /api/v1/{blockchain}/{token}/{address}/token-transfers`
 *
 * Source: https://docs.wdk.tether.io/tools/indexer-api/api-reference
 */
export class WdkIndexerClient {
  constructor(private readonly config: IndexerConfig) {}

  async getTokenBalance(args: QueryArgs): Promise<IndexerTokenBalance> {
    const { blockchain, token, address } = args;
    const data = await this.get<IndexerTokenBalanceResponse>(
      `/api/v1/${blockchain}/${token.toLowerCase()}/${address}/token-balances`,
    );
    return data.tokenBalance;
  }

  async getTokenTransfers(args: QueryArgs): Promise<IndexerTokenTransfer[]> {
    const { blockchain, token, address } = args;
    const data = await this.get<IndexerTokenTransfersResponse>(
      `/api/v1/${blockchain}/${token.toLowerCase()}/${address}/token-transfers`,
    );
    return data.tokenTransfers;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      let body: IndexerErrorResponse = {};
      try {
        body = (await response.json()) as IndexerErrorResponse;
      } catch {
        // Body wasn't JSON — fall through to a synthetic error
      }
      throw new WdkIndexerError(
        response.status,
        body.error ?? `HTTP_${response.status}`,
        body.message ?? `WDK indexer request failed: ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}

/**
 * Returns a configured `WdkIndexerClient` when env credentials are present,
 * `null` otherwise. Pass `config: null` explicitly to force "disabled" in
 * tests without touching `process.env`.
 */
export const createIndexerClient = (
  config: IndexerConfig | null = getIndexerConfig(),
): WdkIndexerClient | null => (config ? new WdkIndexerClient(config) : null);
