import { BaseAsset, type IAsset } from '@tetherto/wdk-react-native-core';
import type { ChainId } from './chains';

export type TokenCategory = 'btc' | 'stablecoin' | 'native' | 'other';

type AssetSpec = {
  network: ChainId;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  category: TokenCategory;
  address?: string | null;
  defaultEnabled?: boolean;
};

const ASSET_SPECS: AssetSpec[] = [
  // Bitcoin variants
  {
    network: 'spark',
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    isNative: true,
    category: 'btc',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    isNative: false,
    category: 'btc',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    defaultEnabled: true,
  },

  // Ethereum native + stablecoins (default enabled)
  {
    network: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    isNative: true,
    category: 'native',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'USDT',
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
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xA0b86991c6218a36c1d19D4a2e9Eb0cE3606eB48',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'ZCHF',
    name: 'Frankencoin',
    decimals: 18,
    isNative: false,
    category: 'stablecoin',
    address: '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
    defaultEnabled: true,
  },
  {
    network: 'ethereum',
    symbol: 'XAUT',
    name: 'Tether Gold',
    decimals: 6,
    isNative: false,
    category: 'other',
    address: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
  },

  // Arbitrum (opt-in)
  {
    network: 'arbitrum',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'arbitrum',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },

  // Polygon (opt-in)
  {
    network: 'polygon',
    symbol: 'MATIC',
    name: 'Polygon',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'polygon',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    category: 'stablecoin',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },

  // Test / experimental networks
  {
    network: 'plasma',
    symbol: 'ETH',
    name: 'Plasma ETH',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'sepolia',
    symbol: 'ETH',
    name: 'Sepolia ETH',
    decimals: 18,
    isNative: true,
    category: 'native',
  },
  {
    network: 'sepolia',
    symbol: 'USDT',
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

export const SELECTABLE_CHAINS: ChainId[] = ['arbitrum', 'polygon'];

const ASSET_CATEGORY_MAP = new Map<string, TokenCategory>(
  ASSET_SPECS.map((spec) => [buildId(spec), spec.category]),
);

export const getCategoryForAsset = (assetId: string): TokenCategory =>
  ASSET_CATEGORY_MAP.get(assetId) ?? 'other';

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
