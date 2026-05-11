import DecimalJS from 'decimal.js';

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
 * CoinGecko coin IDs for the tickers we surface in the wallet. CoinGecko's
 * `simple/price` endpoint accepts a comma-joined `ids=` list, so we keep
 * everything in one upstream object — no per-token round-trips.
 *
 * Updates: replace `decentralized-euro` if dEURO ever moves IDs and
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

type ExchangeRateMap = Record<FiatCurrency, Record<string, number>>;

type CoinGeckoPriceResponse = Record<string, Partial<Record<string, number>>>;

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

async function fetchCoinGeckoPrices(): Promise<ExchangeRateMap> {
  const ids = Object.values(COINGECKO_IDS).join(',');
  const vs = SUPPORTED_CURRENCIES.map((c) => c.toLowerCase()).join(',');
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=${vs}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = (await res.json()) as CoinGeckoPriceResponse;

  const empty: Record<string, number> = {};
  const map: ExchangeRateMap = {
    [FiatCurrency.USD]: { ...empty },
    [FiatCurrency.CHF]: { ...empty },
    [FiatCurrency.EUR]: { ...empty },
  };

  for (const [ticker, coinId] of Object.entries(COINGECKO_IDS) as [AssetTicker, string][]) {
    // eslint-disable-next-line security/detect-object-injection -- coinId comes from a typed iteration over the closed COINGECKO_IDS map
    const entry = json[coinId];
    if (!entry) continue;
    for (const currency of SUPPORTED_CURRENCIES) {
      const lcCurrency = currency.toLowerCase();
      // eslint-disable-next-line security/detect-object-injection -- lcCurrency derived from a fixed FiatCurrency enum
      const price = entry[lcCurrency];
      if (typeof price === 'number' && Number.isFinite(price)) {
        // eslint-disable-next-line security/detect-object-injection -- ticker and currency come from typed iteration over closed unions
        map[currency][ticker] = price;
      }
    }
  }

  // Anchor the USDT rate per currency: CoinGecko reports USDT-USD as ~0.999
  // due to micro de-pegs. Treating it as 1.00 in its own currency keeps the
  // wallet's "1 USD = 1 USDT" intuition stable for fiat conversions that
  // anchor on stablecoins (the conversion fallback in computeFiatValue).
  if (map[FiatCurrency.USD].usdt !== undefined) {
    map[FiatCurrency.USD].usdt = 1;
  }

  return map;
}

class PricingService {
  private static instance: PricingService;
  private fiatExchangeRateCache: ExchangeRateMap | undefined;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): PricingService {
    if (!PricingService.instance) {
      PricingService.instance = new PricingService();
    }
    return PricingService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      this.fiatExchangeRateCache = await fetchCoinGeckoPrices();
      this.isInitialized = true;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to initialize pricing service');
    }
  }

  async getFiatValue(value: number, asset: AssetTicker, currency: FiatCurrency): Promise<number> {
    if (!this.isInitialized || !this.fiatExchangeRateCache) {
      await this.initialize();
    }
    // eslint-disable-next-line security/detect-object-injection -- currency and asset are constrained literal unions
    const rate = this.fiatExchangeRateCache?.[currency]?.[asset];
    if (rate === undefined) return 0;
    return new DecimalJS(value).mul(rate).toNumber();
  }

  getExchangeRate(asset: AssetTicker, currency: FiatCurrency): number | undefined {
    // eslint-disable-next-line security/detect-object-injection -- currency and asset are constrained literal unions
    return this.fiatExchangeRateCache?.[currency]?.[asset];
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const pricingService = PricingService.getInstance();
