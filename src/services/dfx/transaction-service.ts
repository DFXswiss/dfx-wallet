import { dfxApi } from './api';

export type TransactionDto = {
  id: number;
  type: 'Buy' | 'Sell' | 'Swap' | 'Pay';
  state: 'Created' | 'Processing' | 'AmlCheck' | 'Completed' | 'Failed' | 'Returned';
  inputAmount: number;
  inputAsset: string;
  outputAmount: number;
  outputAsset: string;
  date: string;
  txId?: string;
};

export class DfxTransactionService {
  async getTransactions(): Promise<TransactionDto[]> {
    return dfxApi.get<TransactionDto[]>('/transaction/detail');
  }
}

export const dfxTransactionService = new DfxTransactionService();
