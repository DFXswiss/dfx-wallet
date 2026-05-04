import DecimalJS from 'decimal.js';
import { BitfinexPricingClient } from '@tetherto/wdk-pricing-bitfinex-http';
import { PricingProvider } from '@tetherto/wdk-pricing-provider';

export type AssetTicker = 'btc' | 'eth' | 'usdt' | 'xaut' | 'matic';

export enum FiatCurrency {
  USD = 'USD',
  CHF = 'CHF',
}

const TICKERS_TO_FETCH: AssetTicker[] = ['btc', 'eth', 'xaut', 'matic'];

type ExchangeRateMap = Record<FiatCurrency, Record<string, number>>;

const fetchUsdToChfRate = async (): Promise<number> => {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=CHF');
    if (!response.ok) return 1;
    const json = (await response.json()) as { rates?: { CHF?: number } };
    return json.rates?.CHF ?? 1;
  } catch {
    return 1;
  }
};

class PricingService {
  private static instance: PricingService;
  private provider: PricingProvider | null = null;
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
      const client = new BitfinexPricingClient();
      this.provider = new PricingProvider({
        client,
        priceCacheDurationMs: 1000 * 60 * 60,
      });

      const usdRates = await this.fetchUsdRates();
      const usdToChf = await fetchUsdToChfRate();

      this.fiatExchangeRateCache = {
        [FiatCurrency.USD]: usdRates,
        [FiatCurrency.CHF]: Object.fromEntries(
          Object.entries(usdRates).map(([key, value]) => [key, value * usdToChf]),
        ),
      };

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

  private async fetchUsdRates(): Promise<Record<string, number>> {
    if (!this.provider) {
      throw new Error('Pricing provider not initialized');
    }

    const entries = await Promise.all(
      TICKERS_TO_FETCH.map(async (ticker) => {
        try {
          const price = await this.provider!.getLastPrice(ticker, FiatCurrency.USD);
          return [ticker, price] as const;
        } catch {
          return [ticker, 0] as const;
        }
      }),
    );

    return {
      ...Object.fromEntries(entries),
      usdt: 1,
    };
  }
}

export const pricingService = PricingService.getInstance();
