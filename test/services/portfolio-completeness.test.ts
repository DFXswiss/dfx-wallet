import type { BalanceEntry, BalanceMap, BalanceStatus } from '@/services/balances';
import { getAssets } from '@/config/tokens';
import {
  areLocalPortfolioBalancesComplete,
  getPortfolioAssetCompleteness,
  hasSettledBalanceEntry,
  isCombinedPortfolioComplete,
  isLinkedWalletEntryComplete,
} from '@/features/portfolio/portfolio-completeness';
import type { WalletDiscovery } from '@/features/linked-wallets/useLinkedWalletDiscovery';
import { FiatCurrency, pricingService } from '@/services/pricing-service';

const WBTC_ASSET = getAssets(['ethereum']).find(
  (asset) => asset.getId() === 'ethereum-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
);
const TAPROOT_ASSET = getAssets(['bitcoin-taproot']).find(
  (asset) => asset.getId() === 'bitcoin-taproot-native',
);
const ETH_ASSET = getAssets(['ethereum']).find((asset) => asset.getId() === 'ethereum-native');

if (!WBTC_ASSET || !TAPROOT_ASSET || !ETH_ASSET) {
  throw new Error('Expected portfolio completeness test assets');
}

function balanceEntry(
  assetId: string,
  status: BalanceStatus = 'ok',
  rawBalance = '100000000',
): BalanceEntry {
  return { assetId, rawBalance, status, source: 'evm' };
}

function assetCompleteness(
  entry: BalanceEntry | undefined,
  balance = 1,
  pricingReady = true,
) {
  return getPortfolioAssetCompleteness({
    asset: WBTC_ASSET,
    balanceEntry: entry,
    balance,
    canonicalSymbol: 'BTC',
    fiatCurrency: FiatCurrency.USD,
    pricingReady,
  });
}

function linkedEntry(overrides: Partial<WalletDiscovery> = {}): WalletDiscovery {
  return {
    address: '0xaaaa',
    assets: [
      {
        chain: 'ethereum',
        symbol: 'USDT',
        name: 'Tether',
        contract: '0xtoken',
        rawBalance: '1000000',
        balance: 1,
        fiatValue: 1,
      },
    ],
    totalFiat: 1,
    complete: true,
    known: true,
    ...overrides,
  };
}

describe('portfolio completeness', () => {
  beforeEach(() => {
    jest.spyOn(pricingService, 'getExchangeRate').mockReturnValue(50_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getPortfolioAssetCompleteness', () => {
    it('requires a queried asset, an ok balance entry and an available fiat price', () => {
      expect(assetCompleteness(balanceEntry(WBTC_ASSET.getId()))).toEqual({
        isQueried: true,
        isBalanceComplete: true,
        isFiatAvailable: true,
        isComplete: true,
      });
    });

    it.each(['loading', 'error', 'stale', 'idle'] as const)(
      'marks a %s balance entry incomplete',
      (status) => {
        const result = assetCompleteness(balanceEntry(WBTC_ASSET.getId(), status));

        expect(result.isBalanceComplete).toBe(false);
        expect(result.isComplete).toBe(false);
      },
    );

    it('marks a missing queried balance entry incomplete', () => {
      const result = assetCompleteness(undefined);

      expect(result.isBalanceComplete).toBe(false);
      expect(result.isComplete).toBe(false);
    });

    it('excludes a never-queried asset without making the aggregate incomplete', () => {
      const result = getPortfolioAssetCompleteness({
        asset: TAPROOT_ASSET,
        balanceEntry: undefined,
        balance: 1,
        canonicalSymbol: 'BTC',
        fiatCurrency: FiatCurrency.USD,
        pricingReady: false,
      });

      expect(result.isQueried).toBe(false);
      expect(result.isBalanceComplete).toBe(false);
      expect(result.isComplete).toBe(true);
    });

    it('marks a positive balance without a fiat price incomplete', () => {
      jest.spyOn(pricingService, 'getExchangeRate').mockReturnValue(undefined);

      const result = assetCompleteness(balanceEntry(WBTC_ASSET.getId()));

      expect(result.isFiatAvailable).toBe(false);
      expect(result.isComplete).toBe(false);
    });

    it('allows a zero balance when pricing is unavailable', () => {
      const result = assetCompleteness(balanceEntry(WBTC_ASSET.getId(), 'ok', '0'), 0, false);

      expect(result.isFiatAvailable).toBe(true);
      expect(result.isComplete).toBe(true);
    });
  });

  describe('hasSettledBalanceEntry', () => {
    it('returns false for an empty balance map', () => {
      expect(hasSettledBalanceEntry([WBTC_ASSET], new Map())).toBe(false);
    });

    it.each(['loading', 'idle'] as const)(
      'returns false when the only displayed entry is %s',
      (status) => {
        const balances: BalanceMap = new Map([
          [WBTC_ASSET.getId(), balanceEntry(WBTC_ASSET.getId(), status)],
        ]);

        expect(hasSettledBalanceEntry([WBTC_ASSET], balances)).toBe(false);
      },
    );

    it.each(['ok', 'stale', 'error'] as const)(
      'returns true when a displayed entry has settled with %s',
      (status) => {
        const balances: BalanceMap = new Map([
          [WBTC_ASSET.getId(), balanceEntry(WBTC_ASSET.getId(), status)],
        ]);

        expect(hasSettledBalanceEntry([WBTC_ASSET], balances)).toBe(true);
      },
    );

    it('ignores an entry for an asset excluded from balance queries', () => {
      const balances: BalanceMap = new Map([
        [TAPROOT_ASSET.getId(), balanceEntry(TAPROOT_ASSET.getId(), 'ok')],
      ]);

      expect(hasSettledBalanceEntry([TAPROOT_ASSET], balances)).toBe(false);
    });
  });

  describe('areLocalPortfolioBalancesComplete', () => {
    it('returns false while the balance coordinator is loading', () => {
      expect(
        areLocalPortfolioBalancesComplete({
          assets: [WBTC_ASSET],
          balances: new Map([[WBTC_ASSET.getId(), balanceEntry(WBTC_ASSET.getId())]]),
          isLoading: true,
          pricingReady: true,
          fiatCurrency: FiatCurrency.USD,
        }),
      ).toBe(false);
    });

    it('returns true for complete queried balances and ignores native assets', () => {
      const balances: BalanceMap = new Map([
        [WBTC_ASSET.getId(), balanceEntry(WBTC_ASSET.getId())],
      ]);

      expect(
        areLocalPortfolioBalancesComplete({
          assets: [WBTC_ASSET, ETH_ASSET],
          balances,
          isLoading: false,
          pricingReady: true,
          fiatCurrency: FiatCurrency.USD,
        }),
      ).toBe(true);
    });

    it('returns false for a missing queried entry', () => {
      expect(
        areLocalPortfolioBalancesComplete({
          assets: [WBTC_ASSET],
          balances: new Map(),
          isLoading: false,
          pricingReady: true,
          fiatCurrency: FiatCurrency.USD,
        }),
      ).toBe(false);
    });
  });

  describe('isLinkedWalletEntryComplete', () => {
    it('accepts an exact linked-wallet entry', () => {
      expect(isLinkedWalletEntryComplete(linkedEntry())).toBe(true);
    });

    it.each([
      ['unknown', linkedEntry({ known: false })],
      ['incomplete', linkedEntry({ complete: false })],
      [
        'missing a fiat value',
        linkedEntry({ assets: [{ ...linkedEntry().assets[0]!, fiatValue: null }] }),
      ],
      ['missing', undefined],
    ] as const)('rejects an entry that is %s', (_condition, entry) => {
      expect(isLinkedWalletEntryComplete(entry)).toBe(false);
    });
  });

  describe('isCombinedPortfolioComplete', () => {
    const discovery = new Map([['0xaaaa', linkedEntry()]]);

    it('accepts complete local, profile and selected linked-wallet data', () => {
      expect(
        isCombinedPortfolioComplete({
          localBalancesComplete: true,
          linkedProfileIncomplete: false,
          linkedWalletAddresses: ['0xAAAA'],
          linkedDiscovery: discovery,
        }),
      ).toBe(true);
    });

    it.each([
      ['local balances are incomplete', false, false, ['0xaaaa']],
      ['the DFX profile is incomplete', true, true, ['0xaaaa']],
      ['a selected linked-wallet entry is missing', true, false, ['0xbbbb']],
    ] as const)(
      'rejects the combination when %s',
      (_condition, localBalancesComplete, linkedProfileIncomplete, linkedWalletAddresses) => {
        expect(
          isCombinedPortfolioComplete({
            localBalancesComplete,
            linkedProfileIncomplete,
            linkedWalletAddresses,
            linkedDiscovery: discovery,
          }),
        ).toBe(false);
      },
    );
  });
});
