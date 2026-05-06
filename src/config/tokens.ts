import { BaseAsset, type IAsset } from '@tetherto/wdk-react-native-core';
import type { ChainId } from './chains';

export type TokenCategory = 'btc' | 'stablecoin' | 'native' | 'other';

type AssetSpec = {
  network: ChainId;
  symbol: string;
  canonicalSymbol: string;
  canonicalName: string;
  name: string;
  decimals: number;
  isNative: boolean;
  category: TokenCategory;
  address?: string | null;
  defaultEnabled?: boolean;
};

// dEURO (Decentralized Euro) addresses — TODO: replace placeholder zero
// addresses with the real ERC-20 contracts once they are confirmed for
// each L2 deployment.
const DEURO_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ASSET_SPECS: AssetSpec[] = [
  // Bitcoin variants — canonical 'BTC'
  {
    network: 'spark',
    symbol: 'BTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Bitcoin (Lightning)',
    decimals: 8,
    isNative: true,
    category: 'btc',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'WBTC',
    canonicalSymbol: 'BTC',
    canonicalName: 'Bitcoin',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    isNative: false,
    category: 'btc',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    defaultEnabled: true,
  },

  // Ethereum native (used for gas)
  {
    network: 'ethereum',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum',
    decimals: 18,
    isNative: true,
    category: 'native',
    defaultEnabled: true,
  },

  // Dollar (USD) — USDT + USDC across EVMs
  {
    network: 'ethereum',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xA0b86991c6218a36c1d19D4a2e9Eb0cE3606eB48',
    defaultEnabled: true,
  },
  {
    network: 'arbitrum',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  {
    network: 'arbitrum',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  {
    network: 'polygon',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  {
    network: 'polygon',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0x3c499c542cEF5E3811e1192cE70d8cC03d5c3359',
  },
  {
    network: 'base',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  },
  {
    network: 'base',
    symbol: 'USDC',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },

  // Frankencoin (CHF)
  {
    network: 'ethereum',
    symbol: 'ZCHF',
    canonicalSymbol: 'CHF',
    canonicalName: 'Frankencoin',
    name: 'Frankencoin',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
    defaultEnabled: true,
  },

  // dEURO (EUR) — Ethereum address confirmed; L2 contracts pending
  {
    network: 'ethereum',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xbA3f535bbCcCcA2A154b573Ca6c5A49BAAE0a3ea',
    defaultEnabled: true,
  },
  {
    network: 'arbitrum',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: DEURO_ZERO_ADDRESS,
  },
  {
    network: 'polygon',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: DEURO_ZERO_ADDRESS,
  },
  {
    network: 'base',
    symbol: 'dEURO',
    canonicalSymbol: 'EUR',
    canonicalName: 'Euro',
    name: 'dEURO',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: DEURO_ZERO_ADDRESS,
  },

  // Arbitrum / Polygon / Base native (for gas display)
  {
    network: 'arbitrum',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum (Arbitrum)',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'polygon',
    symbol: 'MATIC',
    canonicalSymbol: 'MATIC',
    canonicalName: 'Polygon',
    name: 'Polygon',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'base',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum (Base)',
    decimals: 18,
    isNative: true,
    category: 'native',
  },

  // Test / experimental networks
  {
    network: 'plasma',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Ethereum (Plasma)',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'sepolia',
    symbol: 'ETH',
    canonicalSymbol: 'ETH',
    canonicalName: 'Ethereum',
    name: 'Sepolia ETH',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'sepolia',
    symbol: 'USDT',
    canonicalSymbol: 'USD',
    canonicalName: 'Dollar',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
  },
];

const buildId = (spec: Pick<AssetSpec, 'network' | 'isNative' | 'address'>): string =>
  spec.isNative ? `${spec.network}-native` : `${spec.network}-${spec.address?.toLowerCase()}`;

export const DEFAULT_ENABLED_CHAINS: ChainId[] = Array.from(
  new Set(ASSET_SPECS.filter((spec) => spec.defaultEnabled).map((spec) => spec.network)),
);

export const SELECTABLE_CHAINS: ChainId[] = ['arbitrum', 'polygon', 'base'];

export type AssetMeta = {
  id: string;
  network: ChainId;
  symbol: string;
  canonicalSymbol: string;
  canonicalName: string;
  name: string;
  decimals: number;
  isNative: boolean;
  category: TokenCategory;
  address?: string | null;
};

const ASSET_META_BY_ID = new Map<string, AssetMeta>(
  ASSET_SPECS.map((spec) => [
    buildId(spec),
    {
      id: buildId(spec),
      network: spec.network,
      symbol: spec.symbol,
      canonicalSymbol: spec.canonicalSymbol,
      canonicalName: spec.canonicalName,
      name: spec.name,
      decimals: spec.decimals,
      isNative: spec.isNative,
      category: spec.category,
      address: spec.address ?? null,
    },
  ]),
);

export const getAssetMeta = (assetId: string): AssetMeta | undefined =>
  ASSET_META_BY_ID.get(assetId);

export const getCategoryForAsset = (assetId: string): TokenCategory =>
  ASSET_META_BY_ID.get(assetId)?.category ?? 'other';

export const getAssetsForCanonicalSymbol = (symbol: string, chains?: ChainId[]): AssetMeta[] => {
  const filtered = chains
    ? ASSET_SPECS.filter((spec) => chains.includes(spec.network))
    : ASSET_SPECS;
  return filtered
    .filter((spec) => spec.canonicalSymbol === symbol)
    .map((spec) => ({
      id: buildId(spec),
      network: spec.network,
      symbol: spec.symbol,
      canonicalSymbol: spec.canonicalSymbol,
      canonicalName: spec.canonicalName,
      name: spec.name,
      decimals: spec.decimals,
      isNative: spec.isNative,
      category: spec.category,
      address: spec.address ?? null,
    }));
};

export const getCanonicalNameForSymbol = (canonicalSymbol: string): string =>
  ASSET_SPECS.find((spec) => spec.canonicalSymbol === canonicalSymbol)?.canonicalName ??
  canonicalSymbol;

export const getCategoryForCanonicalSymbol = (canonicalSymbol: string): TokenCategory =>
  ASSET_SPECS.find((spec) => spec.canonicalSymbol === canonicalSymbol)?.category ?? 'other';

export const getAssets = (chains?: ChainId[]): IAsset[] => {
  const filtered = chains
    ? ASSET_SPECS.filter((spec) => chains.includes(spec.network))
    : ASSET_SPECS;
  return filtered.map(
    (spec) =>
      new BaseAsset({
        id: buildId(spec),
        network: spec.network,
        symbol: spec.symbol,
        name: spec.name,
        decimals: spec.decimals,
        isNative: spec.isNative,
        address: spec.address ?? null,
      }),
  );
};

export const getNativeAsset = (network: string): IAsset | undefined =>
  getAssets().find((asset) => asset.getNetwork() === network && asset.isNative());
