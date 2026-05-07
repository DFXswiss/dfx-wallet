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

export class DfxTransactionService {
  async getTransactions(): Promise<TransactionDto[]> {
    return dfxApi.get<TransactionDto[]>('/v1/transaction/detail');
  }
}

export const dfxTransactionService = new DfxTransactionService();
