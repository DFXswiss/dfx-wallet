import { FiatCurrency, pricingService, type AssetTicker } from '@/services/pricing-service';

export const SYMBOL_TO_TICKER = new Map<string, AssetTicker>([
  ['BTC', 'btc'],
  ['ETH', 'eth'],
  ['USD', 'usdt'],
  ['MATIC', 'matic'],
]);

export const SYMBOL_COLORS = new Map<string, string>([
  ['BTC', '#F7931A'],
  ['ETH', '#627EEA'],
  ['USD', '#26A17B'],
  ['CHF', '#D52B1E'],
  ['EUR', '#003399'],
  ['MATIC', '#8247E5'],
]);

export const SYMBOL_GLYPH = new Map<string, string>([
  ['BTC', '₿'],
  ['ETH', 'Ξ'],
  ['USD', '$'],
  ['CHF', '₣'],
  ['EUR', '€'],
  ['MATIC', '⧫'],
]);

export const CHAIN_LABELS = new Map<string, string>([
  ['ethereum', 'Ethereum'],
  ['arbitrum', 'Arbitrum'],
  ['polygon', 'Polygon'],
  ['base', 'Base'],
  ['spark', 'Lightning'],
  ['plasma', 'Plasma'],
  ['sepolia', 'Sepolia'],
]);

export const formatBalance = (rawBalance: string, decimals: number): string => {
  if (!rawBalance) return '0';
  try {
    const value = BigInt(rawBalance);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const fractional = value % divisor;
    if (fractional === 0n) return whole.toString();
    const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fractionalStr ? `${whole}.${fractionalStr}` : whole.toString();
  } catch {
    return rawBalance;
  }
};

export const toNumeric = (formatted: string): number => {
  const n = parseFloat(formatted);
  return Number.isFinite(n) ? n : 0;
};

export const formatNumber = (n: number, maxFractionDigits = 8): string => {
  if (n === 0) return '0';
  if (n >= 1) return n.toFixed(2);
  const fixed = n.toFixed(maxFractionDigits);
  return fixed.replace(/\.?0+$/, '');
};

/**
 * Compact display for narrow contexts (TX rows, asset cards).
 * Examples: 100000000 → "100M", 1500000 → "1.5M", 12345 → "12.3K", 0.0002 → "0.0002".
 */
export const formatCompact = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const trim = (s: string) => s.replace(/\.?0+$/, '');
  if (abs >= 1_000_000_000) return `${sign}${trim((abs / 1_000_000_000).toFixed(2))}B`;
  if (abs >= 1_000_000) return `${sign}${trim((abs / 1_000_000).toFixed(2))}M`;
  if (abs >= 10_000) return `${sign}${trim((abs / 1_000).toFixed(1))}K`;
  if (abs >= 1) return `${sign}${trim(abs.toFixed(2))}`;
  return `${sign}${formatNumber(abs)}`;
};

const insertThousandsSeparators = (whole: string): string => {
  if (whole.length <= 3) return whole;
  const result: string[] = [];
  for (let i = whole.length; i > 0; i -= 3) {
    result.unshift(whole.slice(Math.max(0, i - 3), i));
  }
  return result.join(',');
};

/**
 * Full formatting with thousands separators (detail screens, headlines).
 * Examples: 100000000 → "100,000,000.00", 0.0002 → "0.0002".
 */
export const formatFull = (n: number, maxFractionDigits = 8): string => {
  if (!Number.isFinite(n)) return '0';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1) {
    const parts = abs.toFixed(maxFractionDigits).split('.');
    const whole = parts[0] ?? '0';
    const fraction = parts[1] ?? '';
    const trimmedFraction = fraction.replace(/0+$/, '');
    const wholeWithSep = insertThousandsSeparators(whole);
    const minDecimals = abs < 1000 ? 2 : 0;
    if (trimmedFraction.length >= minDecimals) {
      return `${sign}${wholeWithSep}${trimmedFraction ? '.' + trimmedFraction : ''}`;
    }
    return `${sign}${wholeWithSep}.${trimmedFraction.padEnd(minDecimals, '0')}`;
  }
  return `${sign}${formatNumber(abs, maxFractionDigits)}`;
};

/** Convert a token balance into the user's display fiat currency. */
export function computeFiatValue(
  balance: number,
  canonicalSymbol: string,
  fiatCurrency: FiatCurrency,
  pricingReady: boolean,
): number {
  if (balance === 0) return 0;

  if (canonicalSymbol === 'USD') {
    if (fiatCurrency === FiatCurrency.USD) return balance;
    if (!pricingReady) return balance;
    const usdToChf = pricingService.getExchangeRate('usdt', FiatCurrency.CHF);
    return usdToChf ? balance * usdToChf : balance;
  }
  if (canonicalSymbol === 'CHF') {
    if (fiatCurrency === FiatCurrency.CHF) return balance;
    if (!pricingReady) return balance;
    const usdToChf = pricingService.getExchangeRate('usdt', FiatCurrency.CHF);
    return usdToChf ? balance / usdToChf : balance;
  }
  if (canonicalSymbol === 'EUR') {
    return balance;
  }

  if (!pricingReady) return 0;
  const ticker = SYMBOL_TO_TICKER.get(canonicalSymbol);
  if (!ticker) return 0;
  const rate = pricingService.getExchangeRate(ticker, fiatCurrency);
  return rate ? balance * rate : 0;
}
