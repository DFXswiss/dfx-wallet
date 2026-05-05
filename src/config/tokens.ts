import { BaseAsset, type IAsset } from '@tetherto/wdk-react-native-core';

type AssetSpec = {
  network: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  address?: string | null;
};

const ASSET_SPECS: AssetSpec[] = [
  { network: 'ethereum', symbol: 'ETH', name: 'Ethereum', decimals: 18, isNative: true },
  {
    network: 'ethereum',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  {
    network: 'ethereum',
    symbol: 'XAUT',
    name: 'Tether Gold',
    decimals: 6,
    isNative: false,
    address: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
  },
  { network: 'arbitrum', symbol: 'ETH', name: 'Ethereum', decimals: 18, isNative: true },
  {
    network: 'arbitrum',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  { network: 'polygon', symbol: 'MATIC', name: 'Polygon', decimals: 18, isNative: true },
  {
    network: 'polygon',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  { network: 'spark', symbol: 'BTC', name: 'Bitcoin', decimals: 8, isNative: true },
  { network: 'plasma', symbol: 'ETH', name: 'Plasma ETH', decimals: 18, isNative: true },
  { network: 'sepolia', symbol: 'ETH', name: 'Sepolia ETH', decimals: 18, isNative: true },
  {
    network: 'sepolia',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    address: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
  },
];

const buildId = (spec: AssetSpec): string =>
  spec.isNative ? `${spec.network}-native` : `${spec.network}-${spec.address?.toLowerCase()}`;

export const getAssets = (): IAsset[] =>
  ASSET_SPECS.map(
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

export const getNativeAsset = (network: string): IAsset | undefined =>
  getAssets().find((asset) => asset.getNetwork() === network && asset.isNative());
