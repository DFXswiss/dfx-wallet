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
      const live = await dfxApi.get<TransactionDto[]>('/transaction/detail');
      return live.length > 0 ? live : MOCK_TRANSACTIONS;
    } catch {
      return MOCK_TRANSACTIONS;
    }
  }
}

export const dfxTransactionService = new DfxTransactionService();
