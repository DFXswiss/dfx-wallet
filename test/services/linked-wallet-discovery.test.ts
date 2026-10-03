import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  calculateDiscoveredFiatValue,
  createDiscoveredAsset,
  useLinkedWalletDiscovery,
} from '@/features/linked-wallets/useLinkedWalletDiscovery';
import { EvmBalanceFetcher, type EvmBalanceResult } from '@/services/balances/evm-fetcher';
import * as blockscout from '@/services/explorer/blockscout';
import * as coinList from '@/services/pricing/coingecko-coins-list';
import * as simplePrice from '@/services/pricing/coingecko-simple-price';
import { FiatCurrency } from '@/services/pricing-service';

const WALLET = {
  address: '0x00000000000000000000000000000000000000ab',
  blockchain: 'Ethereum',
  blockchains: ['Ethereum'],
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function mockUnpricedTokenQuery(rawBalance = '12500000') {
  jest.spyOn(blockscout, 'isBlockscoutSupported').mockReturnValue(true);
  jest.spyOn(blockscout, 'getTokenList').mockResolvedValue({
    ok: true,
    value: [
      {
        balance: rawBalance,
        contractAddress: '0x0000000000000000000000000000000000000001',
        decimals: 6,
        name: 'Unknown token',
        symbol: 'UNKNOWN',
      },
    ],
  });
  jest.spyOn(coinList, 'lookupCoinIds').mockResolvedValue(new Map());
  jest.spyOn(simplePrice, 'fetchSimplePrices').mockResolvedValue(new Map());
}

describe('linked-wallet asset pricing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps an unpriced positive balance representable with a null fiat value', () => {
    expect(calculateDiscoveredFiatValue(12.5, undefined)).toBeNull();
    expect(calculateDiscoveredFiatValue(12.5, 0)).toBeNull();
  });

  it('calculates fiat only when a positive price is available', () => {
    expect(calculateDiscoveredFiatValue(2, 125)).toBe(250);
  });

  it('keeps a positive token balance when its CoinGecko id or price is missing', () => {
    expect(
      createDiscoveredAsset({
        chain: 'ethereum',
        symbol: 'UNKNOWN',
        name: 'Unknown token',
        contract: '0x0000000000000000000000000000000000000001',
        rawBalance: '12500000',
        decimals: 6,
      }),
    ).toMatchObject({ balance: 12.5, fiatValue: null });
  });

  it('keeps a Blockscout balance in the query result when CoinGecko has no id', async () => {
    mockUnpricedTokenQuery();
    jest.spyOn(EvmBalanceFetcher.prototype, 'fetch').mockImplementation(async (specs) => {
      const results = new Map<string, EvmBalanceResult>();
      for (const spec of specs) {
        results.set(spec.assetId, {
          assetId: spec.assetId,
          rawBalance: spec.isNative ? '0' : '12500000',
        });
      }
      return results;
    });

    const { result } = renderHook(
      () => useLinkedWalletDiscovery([WALLET], FiatCurrency.CHF, true),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.data.get(WALLET.address)?.assets).toEqual([
        expect.objectContaining({ symbol: 'UNKNOWN', balance: 12.5, fiatValue: null }),
      ]),
    );
  });

  it('keeps placeholder totals only while the fiat currency is unchanged', async () => {
    mockUnpricedTokenQuery();
    const fetchSpy = jest
      .spyOn(EvmBalanceFetcher.prototype, 'fetch')
      .mockImplementationOnce(async (specs) => {
        const token = specs.find((spec) => !spec.isNative)!;
        return new Map<string, EvmBalanceResult>([
          [token.assetId, { assetId: token.assetId, rawBalance: '12500000' }],
        ]);
      })
      .mockImplementation(() => new Promise<Map<string, EvmBalanceResult>>(() => undefined));

    const { result, rerender } = renderHook(
      ({ currency, pricingReady }: { currency: FiatCurrency; pricingReady: boolean }) =>
        useLinkedWalletDiscovery([WALLET], currency, pricingReady),
      {
        initialProps: { currency: FiatCurrency.CHF, pricingReady: true },
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.data.get(WALLET.address)?.assets).toHaveLength(1));

    rerender({ currency: FiatCurrency.CHF, pricingReady: false });
    expect(result.current.data.get(WALLET.address)?.assets).toHaveLength(1);

    rerender({ currency: FiatCurrency.EUR, pricingReady: false });
    expect(result.current.data.size).toBe(0);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
