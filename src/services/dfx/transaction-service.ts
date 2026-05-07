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
  // Local-only UI hints. Not returned by the DFX API.
  network?: string;
  // Counterparty label shown as the row subtitle so the user immediately
  // sees the WHO/WHERE of each TX:
  //   Buy      → on-ramp source ("DFX Banküberweisung", "Kreditkarte")
  //   Sell     → off-ramp destination ("DFX → IBAN ****1234")
  //   Pay      → merchant ("Spar", "Coop Pronto")
  //   Send     → recipient address/contact
  //   Receive  → sender address/contact
  //   Swap    → venue ("In-Wallet Swap", "Uniswap")
  counterparty?: string;
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

// Local-only mock transactions. Cover every supported chain and every TX type
// with a counterparty label so each row clearly shows where money went / came
// from. Removed once the API integration is live.
const MOCK_TRANSACTIONS: TransactionDto[] = [
  // === Pay (merchant) ===
  {
    id: 80001,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 12.5,
    inputAsset: 'USDC',
    outputAmount: 12.5,
    outputAsset: 'USDC',
    date: hoursAgo(1),
    txId: '0x9f8a3b2c4d5e6f7081a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f708',
    network: 'base',
    counterparty: 'Satoshi Coffee',
  },
  {
    id: 80002,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 0.0002,
    inputAsset: 'BTC',
    outputAmount: 0.0002,
    outputAsset: 'BTC',
    date: hoursAgo(4),
    txId: 'bc1qxyzpaytestlightningabcd1234',
    network: 'spark',
    counterparty: 'Spar',
  },
  {
    id: 80003,
    type: 'Pay',
    state: 'Processing',
    inputAmount: 8.0,
    inputAsset: 'ZCHF',
    outputAmount: 8.0,
    outputAsset: 'ZCHF',
    date: daysAgo(1),
    txId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    network: 'ethereum',
    counterparty: 'Coop Pronto',
  },
  {
    id: 80004,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 25,
    inputAsset: 'USDT',
    outputAmount: 25,
    outputAsset: 'USDT',
    date: daysAgo(2),
    txId: '0xpaypolygon1234567890abcdef000000000000000000000000000000000000ff',
    network: 'polygon',
    counterparty: 'Migros',
  },
  {
    id: 80005,
    type: 'Pay',
    state: 'Completed',
    inputAmount: 5.5,
    inputAsset: 'dEURO',
    outputAmount: 5.5,
    outputAsset: 'dEURO',
    date: daysAgo(3),
    txId: '0xpayarbitrum1234567890abcdef00000000000000000000000000000000bbbb',
    network: 'arbitrum',
    counterparty: 'Lidl',
  },

  // === Buy (DFX on-ramp) — counterparty shows the funding source ===
  {
    id: 80010,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 100,
    inputAsset: 'EUR',
    outputAmount: 0.002476,
    outputAsset: 'BTC',
    date: daysAgo(2),
    txId: 'bc1qbuytestabcdef1234567890',
    network: 'spark',
    counterparty: 'DFX SEPA-Überweisung',
  },
  {
    id: 80011,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 250,
    inputAsset: 'EUR',
    outputAmount: 250,
    outputAsset: 'USDC',
    date: daysAgo(3),
    txId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    network: 'arbitrum',
    counterparty: 'DFX Kreditkarte',
  },
  {
    id: 80012,
    type: 'Buy',
    state: 'Processing',
    inputAmount: 50,
    inputAsset: 'CHF',
    outputAmount: 50,
    outputAsset: 'ZCHF',
    date: daysAgo(4),
    network: 'polygon',
    counterparty: 'DFX TWINT',
  },
  {
    id: 80013,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 500,
    inputAsset: 'EUR',
    outputAmount: 500,
    outputAsset: 'dEURO',
    date: daysAgo(5),
    txId: '0xbuydeuroethereum0000000000000000000000000000000000000000abc12345',
    network: 'ethereum',
    counterparty: 'DFX SEPA-Überweisung',
  },
  {
    id: 80014,
    type: 'Buy',
    state: 'Completed',
    inputAmount: 200,
    inputAsset: 'USD',
    outputAmount: 200,
    outputAsset: 'USDT',
    date: daysAgo(6),
    txId: '0xbuyusdtbase00000000000000000000000000000000000000000000000bbbbb',
    network: 'base',
    counterparty: 'DFX Kreditkarte',
  },

  // === Sell (DFX off-ramp) — counterparty shows the payout destination ===
  {
    id: 80020,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 0.001,
    inputAsset: 'BTC',
    outputAmount: 95.31,
    outputAsset: 'EUR',
    date: daysAgo(5),
    txId: '0xfeedfacecafeb00b1234567890abcdef1234567890abcdef1234567890abcdef',
    network: 'ethereum',
    counterparty: 'DFX → IBAN ****4218',
  },
  {
    id: 80021,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 200,
    inputAsset: 'USDT',
    outputAmount: 184.5,
    outputAsset: 'CHF',
    date: daysAgo(7),
    txId: '0xdeadbeef0000000000000000000000000000000000000000000000000000beef',
    network: 'base',
    counterparty: 'DFX → CH IBAN ****8821',
  },
  {
    id: 80022,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 500,
    inputAsset: 'ZCHF',
    outputAmount: 500,
    outputAsset: 'CHF',
    date: daysAgo(8),
    txId: '0xsellzchfarbitrum1234567890abcdef0000000000000000000000000000beef',
    network: 'arbitrum',
    counterparty: 'DFX → CH IBAN ****8821',
  },
  {
    id: 80023,
    type: 'Sell',
    state: 'AmlCheck',
    inputAmount: 0.0005,
    inputAsset: 'BTC',
    outputAmount: 50,
    outputAsset: 'EUR',
    date: daysAgo(9),
    network: 'spark',
    counterparty: 'DFX → IBAN ****4218',
  },
  {
    id: 80024,
    type: 'Sell',
    state: 'Completed',
    inputAmount: 300,
    inputAsset: 'dEURO',
    outputAmount: 300,
    outputAsset: 'EUR',
    date: daysAgo(10),
    txId: '0xselldeuropolygon0000000000000000000000000000000000000000bcdef111',
    network: 'polygon',
    counterparty: 'DFX → IBAN ****4218',
  },

  // === Swap (in-wallet conversion) ===
  {
    id: 80030,
    type: 'Swap',
    state: 'Completed',
    inputAmount: 100,
    inputAsset: 'USDC',
    outputAmount: 99.84,
    outputAsset: 'USDT',
    date: daysAgo(6),
    txId: '0xc0ffee00112233445566778899aabbccddeeff00112233445566778899aabbcc',
    network: 'arbitrum',
    counterparty: 'In-Wallet Swap',
  },
  {
    id: 80031,
    type: 'Swap',
    state: 'Completed',
    inputAmount: 0.5,
    inputAsset: 'WBTC',
    outputAmount: 0.499,
    outputAsset: 'cbBTC',
    date: daysAgo(8),
    txId: '0xswapwbtcbase11223344556677889900aabbccddeeff112233445566778899aa',
    network: 'base',
    counterparty: 'In-Wallet Swap',
  },
  {
    id: 80032,
    type: 'Swap',
    state: 'Failed',
    inputAmount: 1000,
    inputAsset: 'USDT',
    outputAmount: 0,
    outputAsset: 'WBTC',
    date: daysAgo(10),
    network: 'polygon',
    counterparty: 'In-Wallet Swap',
  },
  {
    id: 80033,
    type: 'Swap',
    state: 'Completed',
    inputAmount: 200,
    inputAsset: 'USDC',
    outputAmount: 200,
    outputAsset: 'ZCHF',
    date: daysAgo(11),
    txId: '0xswapusdczchfeth0000000000000000000000000000000000000000000bbb111',
    network: 'ethereum',
    counterparty: 'In-Wallet Swap',
  },

  // === Send (on-chain outgoing transfer) ===
  {
    id: 80040,
    type: 'Send',
    state: 'Completed',
    inputAmount: 25,
    inputAsset: 'USDC',
    outputAmount: 25,
    outputAsset: 'USDC',
    date: hoursAgo(12),
    txId: '0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    network: 'arbitrum',
    counterparty: '0x742d…f44e',
  },
  {
    id: 80041,
    type: 'Send',
    state: 'Completed',
    inputAmount: 0.005,
    inputAsset: 'BTC',
    outputAmount: 0.005,
    outputAsset: 'BTC',
    date: daysAgo(9),
    txId: 'bc1qsendtestabcdef1234567890',
    network: 'spark',
    counterparty: 'Anna · Lightning',
  },
  {
    id: 80042,
    type: 'Send',
    state: 'Completed',
    inputAmount: 100,
    inputAsset: 'ZCHF',
    outputAmount: 100,
    outputAsset: 'ZCHF',
    date: daysAgo(2),
    txId: '0xsendzchfbase000000000000000000000000000000000000000000000000aaaa',
    network: 'base',
    counterparty: '0xc1f5…91b3',
  },

  // === Receive (on-chain incoming transfer) ===
  {
    id: 80050,
    type: 'Receive',
    state: 'Completed',
    inputAmount: 50,
    inputAsset: 'ZCHF',
    outputAmount: 50,
    outputAsset: 'ZCHF',
    date: hoursAgo(0.5),
    txId: '0x1122334455667788990011223344556677889900112233445566778899001122',
    network: 'base',
    counterparty: 'Markus M.',
  },
  {
    id: 80051,
    type: 'Receive',
    state: 'Completed',
    inputAmount: 0.0015,
    inputAsset: 'BTC',
    outputAmount: 0.0015,
    outputAsset: 'BTC',
    date: daysAgo(11),
    txId: 'bc1qreceivetestabcdef0987654321',
    network: 'spark',
    counterparty: 'bc1q…87f3',
  },
  {
    id: 80052,
    type: 'Receive',
    state: 'Completed',
    inputAmount: 75,
    inputAsset: 'USDT',
    outputAmount: 75,
    outputAsset: 'USDT',
    date: daysAgo(4),
    txId: '0xreceiveusdtpolygon00000000000000000000000000000000000000000ccccc',
    network: 'polygon',
    counterparty: '0x4f8a…21cd',
  },
];

export class DfxTransactionService {
  async getTransactions(): Promise<TransactionDto[]> {
    let live: TransactionDto[] = [];
    try {
      live = await dfxApi.get<TransactionDto[]>('/transaction/detail');
    } catch {
      // Auth or network unavailable in dev — fall back to mocks only.
    }
    return [...MOCK_TRANSACTIONS, ...live];
  }
}

export const dfxTransactionService = new DfxTransactionService();
