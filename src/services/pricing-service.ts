import DecimalJS from 'decimal.js';
import { DISCOVERABLE_COINGECKO_IDS } from '@/config/discoverable-tokens';

export type AssetTicker =
  | 'btc'
  | 'eth'
  | 'usdt'
  | 'usdc'
  | 'wbtc'
  | 'cbbtc'
  | 'zchf'
  | 'deuro'
  | 'matic'
  | 'xaut';

export enum FiatCurrency {
  USD = 'USD',
  CHF = 'CHF',
  EUR = 'EUR',
}

/**
 * CoinGecko coin IDs for the curated app-level tickers. Anchors the public
 * Portfolio asset-cards and the legacy `getExchangeRate(ticker, currency)`
 * API; consumers that work with raw CoinGecko IDs (linked-wallet on-chain
 * discovery) use {@link getPriceById} instead.
 *
 * Updates: `decentralized-euro` is dEURO's current ID, and
 * `polygon-ecosystem-token` is the post-rebrand POL listing (former
 * `matic-network` returns `{}` since the Polygon 2.0 migration).
 */
const COINGECKO_IDS: Record<AssetTicker, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  usdt: 'tether',
  usdc: 'usd-coin',
  wbtc: 'wrapped-bitcoin',
  cbbtc: 'coinbase-wrapped-btc',
  zchf: 'frankencoin',
  deuro: 'decentralized-euro',
  matic: 'polygon-ecosystem-token',
  xaut: 'tether-gold',
};

const SUPPORTED_CURRENCIES: FiatCurrency[] = [FiatCurrency.USD, FiatCurrency.CHF, FiatCurrency.EUR];

/** Inner map: `coingeckoId → price`. */
type PriceByCoinId = Record<string, number>;
type ExchangeRateMap = Record<FiatCurrency, PriceByCoinId>;

type CoinGeckoPriceResponse = Record<string, Partial<Record<string, number>>>;

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/** Combine the curated app tickers' IDs with the on-chain-discovery list so
 *  one CoinGecko round-trip warms both pricing surfaces. Deduplicated. */
function buildCoinIdList(): string[] {
  const set = new Set<string>([...Object.values(COINGECKO_IDS), ...DISCOVERABLE_COINGECKO_IDS]);
  return Array.from(set);
}

async function fetchCoinGeckoPrices(): Promise<ExchangeRateMap> {
  const ids = buildCoinIdList().join(',');
  const vs = SUPPORTED_CURRENCIES.map((c) => c.toLowerCase()).join(',');
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=${vs}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = (await res.json()) as CoinGeckoPriceResponse;

  const map: ExchangeRateMap = {
    [FiatCurrency.USD]: {},
    [FiatCurrency.CHF]: {},
    [FiatCurrency.EUR]: {},
  };

  for (const [coinId, entry] of Object.entries(json)) {
    if (!entry) continue;
    for (const currency of SUPPORTED_CURRENCIES) {
      const lcCurrency = currency.toLowerCase();
      // eslint-disable-next-line security/detect-object-injection -- lcCurrency derived from a fixed FiatCurrency enum
      const price = entry[lcCurrency];
      if (typeof price === 'number' && Number.isFinite(price)) {
        // eslint-disable-next-line security/detect-object-injection -- coinId is an API-supplied id keyed into a fresh object map; currency is a typed enum value
        map[currency][coinId] = price;
      }
    }
  }

  // Anchor USDT to 1 in USD: CoinGecko reports USDT-USD as ~0.999 due to
  // micro de-pegs. Treating it as exactly 1 keeps the "1 USD = 1 USDT"
  // intuition stable for downstream fiat conversions that pivot on USDT.
  if (map[FiatCurrency.USD][COINGECKO_IDS.usdt] !== undefined) {
    map[FiatCurrency.USD][COINGECKO_IDS.usdt] = 1;
  }

  return map;
}

class PricingService {
  private static instance: PricingService;
  private cache: ExchangeRateMap | undefined;
  private isInitialized: boolean = false;
  private inflight: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): PricingService {
    if (!PricingService.instance) {
      PricingService.instance = new PricingService();
    }
    return PricingService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        this.cache = await fetchCoinGeckoPrices();
        this.isInitialized = true;
      } catch (error) {
        throw error instanceof Error ? error : new Error('Failed to initialize pricing service');
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  /**
   * Force-refresh the entire price cache. Wired to the Portfolio's
   * pull-to-refresh + cold-start hooks so the displayed fiat sums match
   * CoinGecko within seconds of the user's gesture.
   */
  async refresh(): Promise<void> {
    try {
      this.cache = await fetchCoinGeckoPrices();
      this.isInitialized = true;
    } catch (error) {
      // Keep the previous cache on failure — surfacing stale prices is
      // better than wiping the headline total to zero.
      throw error instanceof Error ? error : new Error('Failed to refresh pricing service');
    }
  }

  async getFiatValue(value: number, asset: AssetTicker, currency: FiatCurrency): Promise<number> {
    if (!this.isInitialized || !this.cache) {
      await this.initialize();
    }
    const rate = this.getExchangeRate(asset, currency);
    if (rate === undefined) return 0;
    return new DecimalJS(value).mul(rate).toNumber();
  }

  getExchangeRate(asset: AssetTicker, currency: FiatCurrency): number | undefined {
    // eslint-disable-next-line security/detect-object-injection -- asset is a constrained literal union
    const coinId = COINGECKO_IDS[asset];
    return this.getPriceById(coinId, currency);
  }

  /**
   * Direct lookup keyed by CoinGecko coin id. Used by the on-chain asset
   * discovery: it walks the discovered tokens' configured CoinGecko IDs
   * and converts raw balances to fiat without going through the
   * `AssetTicker` enum.
   */
  getPriceById(coingeckoId: string, currency: FiatCurrency): number | undefined {
    // eslint-disable-next-line security/detect-object-injection -- currency is a typed enum value; the inner key is an API-supplied string used only as a property read
    return this.cache?.[currency]?.[coingeckoId];
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const pricingService = PricingService.getInstance();
