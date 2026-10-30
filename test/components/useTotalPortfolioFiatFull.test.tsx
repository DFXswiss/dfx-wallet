import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { BalanceEntry, BalanceMap, BalanceSourceResult } from '@/services/balances';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import type { WalletDiscovery } from '@/features/linked-wallets/useLinkedWalletDiscovery';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { useAuthStore, useWalletStore } from '@/store';

let mockBalanceMap: BalanceMap = new Map();
jest.mock('@/services/balances', () => {
  const actual = jest.requireActual('@/services/balances');
  return {
    ...actual,
    useBalances: (): BalanceSourceResult => ({
      data: mockBalanceMap,
      isLoading: false,
      error: null,
    }),
  };
});

const mockEnabledChains = ['ethereum'] as const;
jest.mock('@/features/portfolio/useEnabledChains', () => ({
  useEnabledChains: () => ({
    enabledChains: mockEnabledChains,
    setEnabledChains: jest.fn(),
    toggleChain: jest.fn(),
  }),
}));

jest.mock('@/config/tokens', () => {
  const actual = jest.requireActual('@/config/tokens') as typeof import('@/config/tokens');
  return {
    ...actual,
    getAssets: (chains?: import('@/config/chains').ChainId[]) => {
      const assets = actual.getAssets(chains);
      return [
        ...assets,
        {
          getId: (): string => 'no-meta-asset',
          getDecimals: (): number => 18,
        },
      ];
    },
  };
});

const mockIsSelected = jest.fn((_address: string) => true);
jest.mock('@/features/linked-wallets/useLinkedWalletSelection', () => ({
  useLinkedWalletSelection: () => ({ isSelected: mockIsSelected }),
}));

const mockDiscovery = new Map<string, WalletDiscovery>();
jest.mock('@/features/linked-wallets/useLinkedWalletDiscovery', () => ({
  useLinkedWalletDiscovery: () => ({
    data: mockDiscovery,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

const mockGetUser = jest.fn();
jest.mock('@/features/dfx-backend/services', () => ({
  dfxUserService: {
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
}));

// eslint-disable-next-line import/first
import { useTotalPortfolioFiat } from '@/features/portfolio/useTotalPortfolioFiatFull';

function makeEntry(assetId: string, rawBalance: string): BalanceEntry {
  return {
    assetId,
    rawBalance,
    status: 'ok',
    source: 'wdk',
  };
}

const USDT_ETH_ID = 'ethereum-0xdac17f958d2ee523a2206206994597c13d831ec7';
const WBTC_ETH_ID = 'ethereum-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
const ETH_NATIVE_ID = 'ethereum-native';

function setBalances(entries: Record<string, string>) {
  mockBalanceMap = new Map(Object.entries(entries).map(([k, v]) => [k, makeEntry(k, v)]));
}

const LINKED_A: UserAddressDto = {
  address: '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa',
  blockchain: 'Ethereum',
  blockchains: ['Ethereum'],
};
const LINKED_B: UserAddressDto = {
  address: '0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb',
  blockchain: 'Bitcoin',
  blockchains: ['Bitcoin'],
};
const ACTIVE: UserAddressDto = {
  address: '0xCCCCccccCCCCccccCCCCccccCCCCccccCCCCcccc',
  blockchain: 'Ethereum',
  blockchains: ['Ethereum'],
};

describe('useTotalPortfolioFiat (full)', () => {
  beforeEach(() => {
    setBalances({});
    mockDiscovery.clear();
    mockIsSelected.mockReset();
    mockIsSelected.mockReturnValue(true);
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ addresses: [], activeAddress: null });
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'USD' });
    useAuthStore.setState({ isDfxAuthenticated: false });
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
    jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(pricingService, 'getExchangeRate').mockImplementation((ticker, currency) => {
      if (currency !== FiatCurrency.USD) return undefined;
      if (ticker === 'usdt') return 1;
      if (ticker === 'btc') return 50_000;
      return undefined;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 0 and persists "0" when the user holds nothing', async () => {
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(0));
    expect(useWalletStore.getState().totalBalanceFiat).toBe('0');
  });

  it('sums a 1-USDT holding to 1 USD and skips native ETH', async () => {
    setBalances({
      [USDT_ETH_ID]: '1000000',
      [ETH_NATIVE_ID]: '1000000000000000000',
    });
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(1));
    expect(useWalletStore.getState().totalBalanceFiat).toBe('1');
  });

  it('rounds the persisted total to two decimals', async () => {
    setBalances({ [USDT_ETH_ID]: '123450' });
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBeCloseTo(0.12345, 5));
    expect(useWalletStore.getState().totalBalanceFiat).toBe('0.12');
  });

  it('prices a WBTC holding through the pricing-service rate', async () => {
    setBalances({ [WBTC_ETH_ID]: '100000000' });
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(50_000));
  });

  it('initializes pricing when the service is not yet ready, then marks ready', async () => {
    jest.spyOn(pricingService, 'isReady').mockReturnValue(false);
    const init = jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(init).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('marks pricing not-ready when initialize() rejects', async () => {
    jest.spyOn(pricingService, 'isReady').mockReturnValue(false);
    jest.spyOn(pricingService, 'initialize').mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('clears linked wallets when the user is not DFX-authenticated', async () => {
    useAuthStore.setState({ isDfxAuthenticated: false });
    renderHook(() => useTotalPortfolioFiat());
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('adds selected linked-wallet fiat and skips the active address', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser.mockResolvedValue({
      addresses: [LINKED_A, LINKED_B, ACTIVE],
      activeAddress: ACTIVE,
    });
    mockDiscovery.set(LINKED_A.address.toLowerCase(), {
      address: LINKED_A.address.toLowerCase(),
      assets: [],
      totalFiat: 10,
      known: true,
    });
    mockDiscovery.set(LINKED_B.address.toLowerCase(), {
      address: LINKED_B.address.toLowerCase(),
      assets: [],
      totalFiat: 5,
      known: true,
    });
    mockDiscovery.set(ACTIVE.address.toLowerCase(), {
      address: ACTIVE.address.toLowerCase(),
      assets: [],
      totalFiat: 999,
      known: true,
    });

    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(15));
  });

  it('ignores linked wallets the user has not selected and unknown discovery', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser.mockResolvedValue({
      addresses: [LINKED_A, LINKED_B],
      activeAddress: { address: '0xdddd' },
    });
    mockIsSelected.mockImplementation((addr: string) => addr === LINKED_A.address);
    mockDiscovery.set(LINKED_A.address.toLowerCase(), {
      address: LINKED_A.address.toLowerCase(),
      assets: [],
      totalFiat: 7,
      known: false,
    });

    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('treats a missing addresses array as empty', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser.mockResolvedValue({ addresses: undefined, activeAddress: undefined });
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('clears linked wallets when getUser rejects', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    mockGetUser.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('does not apply a late getUser result after unmount', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    let resolveUser: (value: unknown) => void = () => undefined;
    mockGetUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUser = resolve;
      }),
    );
    const { unmount } = renderHook(() => useTotalPortfolioFiat());
    unmount();
    await act(async () => {
      resolveUser({ addresses: [LINKED_A], activeAddress: null });
    });
  });

  it('does not apply a late getUser rejection after unmount', async () => {
    useAuthStore.setState({ isDfxAuthenticated: true });
    let rejectUser: (reason?: unknown) => void = () => undefined;
    mockGetUser.mockReturnValue(
      new Promise((_, reject) => {
        rejectUser = reject;
      }),
    );
    const { unmount } = renderHook(() => useTotalPortfolioFiat());
    unmount();
    await act(async () => {
      rejectUser(new Error('late'));
    });
  });

  it('persists 0 when the computed total is not finite', async () => {
    const presentation = jest.requireActual('@/config/portfolio-presentation') as typeof import('@/config/portfolio-presentation');
    jest.spyOn(presentation, 'computeFiatValue').mockReturnValue(Number.NaN);
    setBalances({ [USDT_ETH_ID]: '1000000' });
    const { result } = renderHook(() => useTotalPortfolioFiat());
    await waitFor(() => expect(useWalletStore.getState().totalBalanceFiat).toBe('0'));
    expect(Number.isFinite(result.current)).toBe(false);
  });
});
