import { dfxApi } from './api';

// Buy / Sell are reserved for DFX on-/off-ramp transactions.
// Send / Receive are on-chain transfers between the user's wallet and any
// external address. Swap is an in-wallet asset conversion. Pay is a merchant
// payment (also an outgoing on-chain transfer, but tagged for the Pay flow).
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
  // local-only field used by the UI to show a chain badge / explorer link
  // when mocking transactions; not returned by the DFX API today.
  network?: string;
  // local-only field used to show the merchant a Pay transaction was sent to
  recipient?: string;
};

// Local-only mock transactions for development. Spans every supported chain
// and every transaction type so the UI can be exercised without a backend.
const MOCK_TRANSACTIONS: TransactionDto[] = [
  {
    id: 90001,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 12.5,
    inputAsset: 'USDC',
    outputAmount: 12.5,
    outputAsset: 'USDC',
    date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    txId: '0x9f8a3b2c4d5e6f7081a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f708',
    network: 'base',
    recipient: 'Satoshi Coffee',
  },
  {
    id: 90002,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 0.0002,
    inputAsset: 'BTC',
    outputAmount: 0.0002,
    outputAsset: 'BTC',
    date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    txId: 'bc1qxyzpaytestlightningabcd1234',
    network: 'spark',
    recipient: 'Spar',
  },
  {
    id: 90003,
    type: 'Pay',
    state: 'Processing',
    inputAmount: 8.0,
    inputAsset: 'ZCHF',
    outputAmount: 8.0,
    outputAsset: 'ZCHF',
    date: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    txId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    network: 'ethereum',
    recipient: 'Coop Pronto',
  },
  {
    id: 90010,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 100,
    inputAsset: 'EUR',
    outputAmount: 0.002476,
    outputAsset: 'BTC',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    txId: 'bc1qbuytestabcdef1234567890',
    network: 'spark',
  },
  {
    id: 90011,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 250,
    inputAsset: 'EUR',
    outputAmount: 250,
    outputAsset: 'USDC',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    network: 'arbitrum',
  },
  {
    id: 90012,
    type: 'Buy',
    state: 'Processing',
    inputAmount: 50,
    inputAsset: 'CHF',
    outputAmount: 50,
    outputAsset: 'ZCHF',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    network: 'polygon',
  },
  {
    id: 90020,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 0.001,
    inputAsset: 'BTC',
    outputAmount: 95.31,
    outputAsset: 'EUR',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0xfeedfacecafeb00b1234567890abcdef1234567890abcdef1234567890abcdef',
    network: 'ethereum',
  },
  {
    id: 90021,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 200,
    inputAsset: 'USDT',
    outputAmount: 184.5,
    outputAsset: 'CHF',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0xdeadbeef0000000000000000000000000000000000000000000000000000beef',
    network: 'base',
  },
  {
    id: 90030,
    type: 'Swap',
    state: 'Completed',
    inputAmount: 100,
    inputAsset: 'USDC',
    outputAmount: 99.84,
    outputAsset: 'USDT',
    date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0xc0ffee00112233445566778899aabbccddeeff00112233445566778899aabbcc',
    network: 'arbitrum',
  },
  {
    id: 90031,
    type: 'Swap',
    state: 'AmlCheck',
    inputAmount: 0.5,
    inputAsset: 'ETH',
    outputAmount: 1850,
    outputAsset: 'USDC',
    date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    network: 'ethereum',
  },
  {
    id: 90032,
    type: 'Swap',
    state: 'Failed',
    inputAmount: 1000,
    inputAsset: 'USDT',
    outputAmount: 0,
    outputAsset: 'WBTC',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    network: 'polygon',
  },
  {
    id: 90040,
    type: 'Send',
    state: 'Completed',
    inputAmount: 25,
    inputAsset: 'USDC',
    outputAmount: 25,
    outputAsset: 'USDC',
    date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    txId: '0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    network: 'arbitrum',
  },
  {
    id: 90041,
    type: 'Send',
    state: 'Completed',
    inputAmount: 0.005,
    inputAsset: 'BTC',
    outputAmount: 0.005,
    outputAsset: 'BTC',
    date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    txId: 'bc1qsendtestabcdef1234567890',
    network: 'spark',
  },
  {
    id: 90050,
    type: 'Receive',
    state: 'Completed',
    inputAmount: 50,
    inputAsset: 'ZCHF',
    outputAmount: 50,
    outputAsset: 'ZCHF',
    date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    txId: '0x1122334455667788990011223344556677889900112233445566778899001122',
    network: 'base',
  },
  {
    id: 90051,
    type: 'Receive',
    state: 'Completed',
    inputAmount: 0.0015,
    inputAsset: 'BTC',
    outputAmount: 0.0015,
    outputAsset: 'BTC',
    date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    txId: 'bc1qreceivetestabcdef0987654321',
    network: 'spark',
  },
  // Whale-scale entries to verify number scaling up to 100M.
  {
    id: 90100,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 100_000_000,
    inputAsset: 'EUR',
    outputAmount: 100_000_000,
    outputAsset: 'USDC',
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0xbeefcafe1234567890abcdef1234567890abcdef1234567890abcdef00000001',
    network: 'ethereum',
  },
  {
    id: 90101,
    type: 'Receive',
    state: 'Completed',
    inputAmount: 50_000_000,
    inputAsset: 'ZCHF',
    outputAmount: 50_000_000,
    outputAsset: 'ZCHF',
    date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0xfeedfacecafe000000000000000000000000000000000000000000000000beef',
    network: 'base',
  },
  {
    id: 90102,
    type: 'Send',
    state: 'Completed',
    inputAmount: 1_500_000,
    inputAsset: 'USDT',
    outputAmount: 1_500_000,
    outputAsset: 'USDT',
    date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0x123abc456def789ghi000000000000000000000000000000000000000000ffff',
    network: 'polygon',
  },
  {
    id: 90103,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 12.5,
    inputAsset: 'BTC',
    outputAmount: 1_250_000,
    outputAsset: 'EUR',
    date: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0xabcdef1234567890aabbccddeeff00112233445566778899aabbccddeeff0011',
    network: 'ethereum',
  },
  {
    id: 90104,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 9_999_999.99,
    inputAsset: 'USDC',
    outputAmount: 9_999_999.99,
    outputAsset: 'USDC',
    date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    txId: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    network: 'arbitrum',
    recipient: 'Tesla Inc.',
  },
  {
    id: 90105,
    type: 'Receive',
    state: 'Completed',
    inputAmount: 0.00000001,
    inputAsset: 'BTC',
    outputAmount: 0.00000001,
    outputAsset: 'BTC',
    date: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
    txId: 'bc1qsmallesttestamount000000000000',
    network: 'spark',
  },
];

export class DfxTransactionService {
  async getTransactions(): Promise<TransactionDto[]> {
    let live: TransactionDto[] = [];
    try {
      live = await dfxApi.get<TransactionDto[]>('/transaction/detail');
    } catch {
      // Auth/network unavailable in dev — fall back to mocks only
    }
    return [...MOCK_TRANSACTIONS, ...live];
  }
}

export const dfxTransactionService = new DfxTransactionService();
