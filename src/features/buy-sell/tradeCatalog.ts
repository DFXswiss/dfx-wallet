import type { ChainId } from '@/config/chains';

// DFX bank-transfer Buy only supports EUR (SEPA) and CHF (SIC) — USD removed.
export const CURRENCIES = ['CHF', 'EUR'] as const;

// DFX payouts only support EUR and CHF bank transfers — USD removed.
export const FIAT_CURRENCIES = ['CHF', 'EUR'] as const;

// What the user is buying. Each asset maps to one or more chains, and each
// chain offers one or more concrete tokens (e.g. USD on Ethereum has both
// USDT and USDC; CHF has only ZCHF; BTC has only the native asset).
export type BuyChain = {
  chain: ChainId;
  label: string;
  blockchain: string;
  tokens: { assetSymbol: string; label: string }[];
  /** Pill is shown but tapping it surfaces a "not yet supported" hint
   *  instead of running the quote/link flow (e.g. Spark/Lightning native:
   *  DFX' /v1/auth doesn't accept the WDK Spark signature yet). */
  unsupported?: boolean;
};
export type BuyAsset = {
  symbol: string;
  label: string;
  chains: BuyChain[];
};

export type SellChain = {
  chain: ChainId;
  label: string;
  blockchain: string;
  tokens: { assetSymbol: string; label: string }[];
};
export type SellAsset = {
  symbol: string;
  chains: SellChain[];
};

const USD_TOKENS = [
  { assetSymbol: 'USDT', label: 'USDT' },
  { assetSymbol: 'USDC', label: 'USDC' },
];

export const BUY_ASSETS: BuyAsset[] = [
  {
    symbol: 'BTC',
    label: 'Bitcoin',
    chains: [
      {
        chain: 'bitcoin',
        label: 'SegWit',
        blockchain: 'Bitcoin',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-taproot',
        // Taproot pill = the DFX Lightning Address (lightning.space-managed
        // Taproot Asset channels). Stays consistent with receive's "Taproot"
        // label so users see one BTC layer name across screens.
        label: 'Taproot',
        blockchain: 'Lightning',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-lightning',
        // Lightning pill = same DFX Lightning Network rails as Taproot
        // (also driven by the lightning.space LDS user). Surfaced as a
        // separate pill because "Lightning" is the label most users expect.
        // Auth/buy flow routes through the LDS LNURL helper just like
        // Taproot.
        label: 'Lightning',
        blockchain: 'Lightning',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'cbBTC', label: 'cbBTC' }],
      },
    ],
  },
  {
    symbol: 'CHF',
    label: 'Frankencoin',
    chains: [
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
    ],
  },
  {
    symbol: 'EUR',
    label: 'dEURO',
    chains: [
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
    ],
  },
  {
    symbol: 'USD',
    label: 'Dollar',
    chains: [
      { chain: 'ethereum', label: 'Ethereum', blockchain: 'Ethereum', tokens: USD_TOKENS },
      { chain: 'arbitrum', label: 'Arbitrum', blockchain: 'Arbitrum', tokens: USD_TOKENS },
      { chain: 'polygon', label: 'Polygon', blockchain: 'Polygon', tokens: USD_TOKENS },
      { chain: 'base', label: 'Base', blockchain: 'Base', tokens: USD_TOKENS },
    ],
  },
];

export const SELL_ASSETS: SellAsset[] = [
  {
    symbol: 'BTC',
    chains: [
      {
        chain: 'bitcoin',
        label: 'SegWit',
        blockchain: 'Bitcoin',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-taproot',
        label: 'Taproot',
        blockchain: 'Lightning',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'bitcoin-lightning',
        // Lightning pill = same LDS lightning.space rails as Taproot.
        label: 'Lightning',
        blockchain: 'Lightning',
        tokens: [{ assetSymbol: 'BTC', label: 'BTC' }],
      },
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'WBTC', label: 'WBTC' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'cbBTC', label: 'cbBTC' }],
      },
    ],
  },
  {
    symbol: 'CHF',
    chains: [
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'ZCHF', label: 'ZCHF' }],
      },
    ],
  },
  {
    symbol: 'EUR',
    chains: [
      {
        chain: 'ethereum',
        label: 'Ethereum',
        blockchain: 'Ethereum',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'arbitrum',
        label: 'Arbitrum',
        blockchain: 'Arbitrum',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'polygon',
        label: 'Polygon',
        blockchain: 'Polygon',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
      {
        chain: 'base',
        label: 'Base',
        blockchain: 'Base',
        tokens: [{ assetSymbol: 'dEURO', label: 'dEURO' }],
      },
    ],
  },
  {
    symbol: 'USD',
    chains: [
      { chain: 'ethereum', label: 'Ethereum', blockchain: 'Ethereum', tokens: USD_TOKENS },
      { chain: 'arbitrum', label: 'Arbitrum', blockchain: 'Arbitrum', tokens: USD_TOKENS },
      { chain: 'polygon', label: 'Polygon', blockchain: 'Polygon', tokens: USD_TOKENS },
      { chain: 'base', label: 'Base', blockchain: 'Base', tokens: USD_TOKENS },
    ],
  },
];
