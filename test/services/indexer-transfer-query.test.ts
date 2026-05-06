import { BaseAsset } from '@tetherto/wdk-react-native-core';
import { getIndexerTokenTransferQuery } from '@/services/wdk-indexer/indexer-transfer-query';

const asset = (spec: {
  network: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  address?: string | null;
}) =>
  new BaseAsset({
    id: spec.isNative ? `${spec.network}-native` : `${spec.network}-${spec.address}`,
    network: spec.network,
    symbol: spec.symbol,
    name: spec.name,
    decimals: spec.decimals,
    isNative: spec.isNative,
    address: spec.address ?? null,
  });

describe('getIndexerTokenTransferQuery', () => {
  it('returns usdt on ethereum for USDT', () => {
    const a = asset({
      network: 'ethereum',
      symbol: 'USDT',
      name: 'Tether',
      decimals: 6,
      isNative: false,
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    });
    expect(getIndexerTokenTransferQuery(a, '0xabc')).toEqual({
      blockchain: 'ethereum',
      token: 'usdt',
    });
  });

  it('returns null for native ETH on ethereum', () => {
    const a = asset({
      network: 'ethereum',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      isNative: true,
    });
    expect(getIndexerTokenTransferQuery(a, '0xabc')).toBeNull();
  });

  it('returns null for MATIC on polygon', () => {
    const a = asset({
      network: 'polygon',
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      isNative: true,
    });
    expect(getIndexerTokenTransferQuery(a, '0xabc')).toBeNull();
  });

  it('returns null for plasma', () => {
    const a = asset({
      network: 'plasma',
      symbol: 'ETH',
      name: 'Plasma ETH',
      decimals: 18,
      isNative: true,
    });
    expect(getIndexerTokenTransferQuery(a, '0xabc')).toBeNull();
  });

  it('returns spark/btc only for spark1 addresses', () => {
    const a = asset({
      network: 'spark',
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      isNative: true,
    });
    expect(getIndexerTokenTransferQuery(a, '0x1234')).toBeNull();
    expect(getIndexerTokenTransferQuery(a, 'spark1qqq82')).toEqual({
      blockchain: 'spark',
      token: 'btc',
    });
  });
});
