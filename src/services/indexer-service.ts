import { env } from '@/config/env';

export type TokenTransfer = {
  blockchain: string;
  blockNumber: number;
  transactionHash: string;
  transferIndex: number;
  token: string;
  amount: string;
  timestamp: number;
  transactionIndex: number;
  logIndex: number;
  from: string;
  to: string;
};

type TransferRequest = {
  blockchain: string;
  token: string;
  address: string;
  limit?: number;
  fromTs?: number;
  toTs?: number;
};

type BatchTransferResponse = { transfers: TokenTransfer[] }[];

class IndexerService {
  private get baseUrl(): string {
    return env.wdkIndexerUrl;
  }

  private get headers(): HeadersInit {
    return {
      accept: 'application/json',
      'x-api-key': env.wdkIndexerApiKey,
      'Content-Type': 'application/json',
    };
  }

  async getTokenTransfers(requests: TransferRequest[]): Promise<TokenTransfer[]> {
    const payload = requests.map((r) => ({
      blockchain: r.blockchain,
      token: r.token,
      address: r.address,
      limit: r.limit ?? 100,
      ...(r.fromTs !== undefined && { fromTs: r.fromTs }),
      ...(r.toTs !== undefined && { toTs: r.toTs }),
    }));

    const response = await fetch(`${this.baseUrl}/api/v1/batch/token-transfers`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Indexer API error: ${response.status}`);
    }

    const data = (await response.json()) as BatchTransferResponse;

    return data.flatMap((item) => item.transfers ?? []);
  }
}

export const indexerService = new IndexerService();
