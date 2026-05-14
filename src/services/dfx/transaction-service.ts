import { dfxApi } from './api';

export type TransactionDto = {
  id: number;
  type: 'Buy' | 'Sell' | 'Swap' | 'Pay' | 'Send' | 'Receive';
  state: 'Created' | 'Processing' | 'AmlCheck' | 'Completed' | 'Failed' | 'Returned';
  inputAmount: number;
  inputAsset: string;
  outputAmount: number;
  outputAsset: string;
  date: string;
  txId?: string;
  // Local-only UI hints not returned by the DFX API yet.
  network?: string;
  // Counterparty label shown as the row subtitle so the user immediately
  // sees the WHO/WHERE of each TX:
  //   Buy     → on-ramp source ("DFX SEPA-Überweisung", "DFX Kreditkarte")
  //   Sell    → off-ramp destination ("DFX → IBAN ****1234")
  //   Pay     → merchant ("Spar", "Coop Pronto")
  //   Send    → recipient address/contact
  //   Receive → sender address/contact
  //   Swap    → venue ("In-Wallet Swap", "Uniswap")
  counterparty?: string;
};

export type TaxReportType = 'CoinTracking' | 'ChainReport' | 'Compact';

const MOCK_TRANSACTIONS: TransactionDto[] = [
  {
    id: 1001,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 5000,
    inputAsset: 'CHF',
    outputAmount: 0.052,
    outputAsset: 'BTC',
    date: '2026-05-05T14:22:00Z',
    txId: '0xabc123',
  },
  {
    id: 1002,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 10000,
    inputAsset: 'EUR',
    outputAmount: 10000,
    outputAsset: 'ZCHF',
    date: '2026-05-04T09:15:00Z',
    txId: '0xdef456',
  },
  {
    id: 1003,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 5000,
    inputAsset: 'USDT',
    outputAmount: 4520,
    outputAsset: 'CHF',
    date: '2026-05-03T16:45:00Z',
    txId: '0xghi789',
  },
  {
    id: 1004,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 0.001,
    inputAsset: 'BTC',
    outputAmount: 45.5,
    outputAsset: 'CHF',
    date: '2026-05-02T12:30:00Z',
    txId: '0xjkl012',
  },
  {
    id: 1005,
    type: 'Buy',
    state: 'Processing',
    inputAmount: 20000,
    inputAsset: 'CHF',
    outputAmount: 20000,
    outputAsset: 'ZCHF',
    date: '2026-05-01T08:00:00Z',
  },
  {
    id: 1006,
    type: 'Swap',
    state: 'Completed',
    inputAmount: 1000,
    inputAsset: 'USDC',
    outputAmount: 980,
    outputAsset: 'USDT',
    date: '2026-04-30T19:20:00Z',
    txId: '0xmno345',
  },
  {
    id: 1007,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 0.0005,
    inputAsset: 'BTC',
    outputAmount: 28.9,
    outputAsset: 'CHF',
    date: '2026-04-29T11:10:00Z',
    txId: '0xpqr678',
  },
  {
    id: 1008,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 3000,
    inputAsset: 'EUR',
    outputAmount: 3000,
    outputAsset: 'dEURO',
    date: '2026-04-28T15:55:00Z',
    txId: '0xstu901',
  },
  {
    id: 1009,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 10000,
    inputAsset: 'ZCHF',
    outputAmount: 9950,
    outputAsset: 'CHF',
    date: '2026-04-27T10:30:00Z',
    txId: '0xvwx234',
  },
  {
    id: 1010,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 0.002,
    inputAsset: 'BTC',
    outputAmount: 120,
    outputAsset: 'CHF',
    date: '2026-04-26T18:00:00Z',
    txId: '0xyza567',
  },
];

export class DfxTransactionService {
  async getTransactions(): Promise<TransactionDto[]> {
    try {
      const live = await dfxApi.get<TransactionDto[]>('/v1/transaction/detail');
      return live.length > 0 ? live : MOCK_TRANSACTIONS;
    } catch {
      return MOCK_TRANSACTIONS;
    }
  }

  /**
   * Two-step CSV export for the user's transaction history. Step 1 PUTs
   * the date range + report-type with the auth Bearer and gets back a
   * single-use 16-char file key. Step 2 streams the CSV from a public GET
   * with that key (the key is consumed on first read server-side).
   *
   * Returns the public download URL — caller can hand it to
   * `expo-file-system` to save and `expo-sharing` to surface the system
   * share-sheet (mirrors realunit-app's PDF flow).
   */
  async createCsvExport(params: {
    from?: Date;
    to?: Date;
    type?: TaxReportType;
  }): Promise<{ fileKey: string; downloadUrl: string }> {
    const queryParts: string[] = [];
    if (params.from) queryParts.push(`from=${encodeURIComponent(params.from.toISOString())}`);
    if (params.to) queryParts.push(`to=${encodeURIComponent(params.to.toISOString())}`);
    queryParts.push(`type=${params.type ?? 'CoinTracking'}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    // PUT body must be present; an empty object is fine. The query string
    // carries the actual filters.
    const fileKey = await dfxApi.put<string>(`/v1/transaction/csv${query}`, {});
    return {
      fileKey,
      downloadUrl: `${dfxApi.baseUrlPublic()}/v1/transaction/csv?key=${encodeURIComponent(fileKey)}`,
    };
  }
}

export const dfxTransactionService = new DfxTransactionService();
