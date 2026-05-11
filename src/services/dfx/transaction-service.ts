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

export class DfxTransactionService {
  async getTransactions(): Promise<TransactionDto[]> {
    return dfxApi.get<TransactionDto[]>('/v1/transaction/detail');
  }

  /**
   * Two-step CSV export for the user's transaction history. Step 1 PUTs
   * the date range + report-type + the user's active wallet address (the
   * server rejects an empty body with `userAddress must be a string …`)
   * with the auth Bearer and gets back a single-use 16-char file key.
   * Step 2 streams the CSV from a public GET with that key (the key is
   * consumed on first read server-side).
   *
   * Returns the public download URL — caller can hand it to
   * `expo-file-system` to save and `expo-sharing` to surface the system
   * share-sheet (mirrors realunit-app's PDF flow).
   */
  async createCsvExport(params: {
    userAddress: string;
    from?: Date;
    to?: Date;
    type?: TaxReportType;
  }): Promise<{ fileKey: string; downloadUrl: string }> {
    const queryParts: string[] = [];
    if (params.from) queryParts.push(`from=${encodeURIComponent(params.from.toISOString())}`);
    if (params.to) queryParts.push(`to=${encodeURIComponent(params.to.toISOString())}`);
    queryParts.push(`type=${params.type ?? 'CoinTracking'}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    const fileKey = await dfxApi.put<string>(`/v1/transaction/csv${query}`, {
      userAddress: params.userAddress,
    });
    return {
      fileKey,
      downloadUrl: `${dfxApi.baseUrlPublic()}/v1/transaction/csv?key=${encodeURIComponent(fileKey)}`,
    };
  }
}

export const dfxTransactionService = new DfxTransactionService();
