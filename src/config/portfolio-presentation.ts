import { FiatCurrency, pricingService, type AssetTicker } from '@/services/pricing-service';

/**
 * Resolve the wallet store's `selectedCurrency` string ("CHF" / "EUR" /
 * "USD") to the typed {@link FiatCurrency} enum. Centralised so screens
 * and hooks don't ship their own ternary that drops EUR to USD.
 */
export function resolveFiatCurrency(symbol: string | null | undefined): FiatCurrency {
  if (symbol === 'CHF') return FiatCurrency.CHF;
  if (symbol === 'EUR') return FiatCurrency.EUR;
  return FiatCurrency.USD;
}

// Maps a *canonical* portfolio symbol (BTC, USD, CHF, EUR, ETH, …) to the
// CoinGecko-backed ticker used for fiat conversion. The fallback chain in
// `computeFiatValue` uses these to translate token balances into the user's
// selected display currency. We pin the fiat-pegged tokens to their
// stablecoin proxies (`USD → usdt`, `CHF → zchf`, `EUR → deuro`) so the
// rate query always resolves even when the user holds the token directly.
export const SYMBOL_TO_TICKER = new Map<string, AssetTicker>([
  ['BTC', 'btc'],
  ['ETH', 'eth'],
  ['USD', 'usdt'],
  ['CHF', 'zchf'],
  ['EUR', 'deuro'],
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
  ['spark', 'Bitcoin Lightning'],
  ['bitcoin', 'Bitcoin (SegWit)'],
  ['bitcoin-taproot', 'Bitcoin (Taproot)'],
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
    // `fractional > 0` so the padded string has at least one non-zero digit,
    // meaning `fractionalStr` is never empty after the trailing-zero strip.
    const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fractionalStr}`;
  } catch {
    return rawBalance;
  }
};

export const toNumeric = (formatted: string): number => {
  const n = parseFloat(formatted);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Validate a user-entered non-negative decimal amount and normalize its optional
 * comma or dot separator to a dot. Whole numbers and one separator with digits
 * on both sides are accepted; malformed, empty, negative, or non-finite input
 * returns `null`.
 */
export const normalizeDecimalAmount = (displayAmount: string): string | null => {
  let separator: ',' | '.' | null = null;
  for (const character of displayAmount) {
    if (character !== ',' && character !== '.') continue;
    if (separator !== null) return null;
    separator = character;
  }

  let wholePart = displayAmount;
  let fractionalPart: string | null = null;
  if (separator !== null) {
    [wholePart = '', fractionalPart = ''] = displayAmount.split(separator);
  }
  if (!/^\d+$/.test(wholePart) || (fractionalPart !== null && !/^\d+$/.test(fractionalPart))) {
    return null;
  }

  const normalized = fractionalPart === null ? wholePart : `${wholePart}.${fractionalPart}`;
  return Number.isFinite(Number(normalized)) ? normalized : null;
};

export const hasExcessPrecision = (displayAmount: string, decimals: number): boolean => {
  const match = displayAmount.trim().match(/^\d*[.,](\d*)$/);
  return match !== null && (match[1]?.length ?? 0) > decimals;
};

/**
 * Parse a user-typed decimal amount ("1", "1.5", "0,5") into the asset's
 * smallest unit as a decimal string. Uses BigInt — never Number — so it
 * preserves precision past 2^53. Empty, malformed, or excessively precise
 * input returns "0" rather than silently changing the requested amount.
 */
export const parseUnits = (displayAmount: string, decimals: number): string => {
  const trimmed = displayAmount.trim();
  if (!trimmed || trimmed === '.' || trimmed === ',') return '0';
  if (!/^\d*[.,]?\d*$/.test(trimmed)) return '0';
  if (hasExcessPrecision(trimmed, decimals)) return '0';
  const [whole, fracRaw = ''] = trimmed.split(/[.,]/);
  // `split(/[.,]/)` always yields at least one element, so `whole` is defined.
  // It may still be the empty string for inputs like ".5" — fall back to "0".
  const wholePart = whole ? whole : '0';
  const frac = fracRaw.padEnd(decimals, '0');
  const wholeBig = BigInt(wholePart) * BigInt(10) ** BigInt(decimals);
  const fracBig = frac === '' ? 0n : BigInt(frac);
  return (wholeBig + fracBig).toString();
};

export const formatNumber = (n: number, maxFractionDigits = 8): string => {
  if (n === 0) return '0';
  if (n >= 1) return n.toFixed(2);
  const fixed = n.toFixed(maxFractionDigits);
  return fixed.replace(/\.?0+$/, '');
};

/** Format a fiat amount with two decimals and CH thousands separator (1'234.56). */
export const formatFiat = (n: number): string =>
  Number.isFinite(n)
    ? n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

/** Format a crypto amount with up to 8 decimals and CH thousands separator. */
export const formatCryptoAmount = (n: number): string =>
  Number.isFinite(n)
    ? n.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
    : '0';

/**
 * Convert a token balance into the user's display fiat currency.
 *
 * CoinGecko returns the token-vs-fiat rate directly for every supported
 * (ticker, currency) pair, so this function is a thin lookup: pick the
 * ticker for the canonical symbol, multiply by the rate. The previous
 * implementation hand-rolled USD→CHF arithmetic via `usdt` because the
 * Bitfinex client only quoted USD prices; with CoinGecko we don't need
 * the fallback path anymore. A 1:1 short-circuit stays for the case where
 * the token is already in the user's currency (e.g. holding USDC and
 * displaying in USD).
 */
export function computeFiatValue(
  balance: number,
  canonicalSymbol: string,
  fiatCurrency: FiatCurrency,
  pricingReady: boolean,
): number {
  if (balance === 0) return 0;

  // Stablecoin held in its own currency — skip the rate lookup so the
  // headline is exact even before pricing finishes initialising.
  if (
    (canonicalSymbol === 'USD' && fiatCurrency === FiatCurrency.USD) ||
    (canonicalSymbol === 'CHF' && fiatCurrency === FiatCurrency.CHF) ||
    (canonicalSymbol === 'EUR' && fiatCurrency === FiatCurrency.EUR)
  ) {
    return balance;
  }

  if (!pricingReady) {
    // Pre-init: surface the token amount at par so the user sees a
    // non-zero number while the price feed warms up. Off-by-rate but
    // self-corrects within a few seconds once initialize() resolves.
    if (canonicalSymbol === 'USD' || canonicalSymbol === 'CHF' || canonicalSymbol === 'EUR') {
      return balance;
    }
    return 0;
  }

  const ticker = SYMBOL_TO_TICKER.get(canonicalSymbol);
  if (!ticker) return 0;
  const rate = pricingService.getExchangeRate(ticker, fiatCurrency);
  return rate ? balance * rate : 0;
}
