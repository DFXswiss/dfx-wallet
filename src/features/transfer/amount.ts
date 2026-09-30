import DecimalJS from 'decimal.js';
import type { AmountKey } from '@/components/AmountKeypad';
import { formatBalance, parseUnits } from '@/config/portfolio-presentation';
import { FiatCurrency, pricingService, type AssetTicker } from '@/services/pricing-service';

/**
 * Amount logic of the send screen: keypad input, the unit bar (asset first,
 * then CHF, then EUR) and the conversion from what the user typed to the
 * asset amount that goes into `useSendFlow.send`. Pure functions, all money
 * math in decimal.js — no floats.
 */

// Enough significant digits for 18-decimal assets plus a large integer part;
// ROUND_DOWN so a division never yields more than the exact quotient.
const D = DecimalJS.clone({ precision: 60, rounding: DecimalJS.ROUND_DOWN });
type Dec = InstanceType<typeof D>;

export const FIAT_UNITS = ['CHF', 'EUR'] as const;
/** Decimal places of a fiat amount. */
export const FIAT_DECIMALS = 2;
const MAX_INTEGER_DIGITS = 12;
/** Decimals shown for the asset-side equivalent line; BTC is the only asset worth more than two. */
const DISPLAY_DECIMALS = new Map<string, number>([['BTC', 8]]);
const DEFAULT_DISPLAY_DECIMALS = 2;

/** Send-screen symbol → pricing ticker. The stablecoins are priced through their token. */
export const ASSET_TICKERS: ReadonlyMap<string, AssetTicker> = new Map<string, AssetTicker>([
  ['BTC', 'btc'],
  ['CHF', 'zchf'],
  ['EUR', 'deuro'],
  ['USD', 'usdt'],
]);

const FIAT_CURRENCIES: ReadonlyMap<string, FiatCurrency> = new Map<string, FiatCurrency>([
  ['CHF', FiatCurrency.CHF],
  ['EUR', FiatCurrency.EUR],
]);

export type AmountAsset = { symbol: string; decimals: number };
/** Price of ONE asset unit in each fiat unit, only for units that have a rate. */
export type UnitRates = ReadonlyMap<string, number>;

export function maxDecimalsFor(unit: string, asset: AmountAsset): number {
  return unit === asset.symbol ? asset.decimals : FIAT_DECIMALS;
}

/**
 * One keypad press applied to the typed text. No leading zeros, one decimal
 * separator, at most `maxDecimals` fraction digits, bounded integer part.
 */
export function applyKey(input: string, key: AmountKey, maxDecimals: number): string {
  if (key === 'del') return input.slice(0, -1);
  if (key === '.') {
    if (maxDecimals <= 0 || input.includes('.')) return input;
    return input === '' ? '0.' : `${input}.`;
  }
  if (input === '0') return key;
  const dot = input.indexOf('.');
  if (dot === -1) return input.length >= MAX_INTEGER_DIGITS ? input : `${input}${key}`;
  return input.length - dot - 1 >= maxDecimals ? input : `${input}${key}`;
}

function parseInput(input: string): Dec | undefined {
  return /^\d+\.?\d*$/.test(input) ? new D(input) : undefined;
}

/** Units offered for an asset: the asset itself first, then CHF, then EUR, without duplicates. */
export function getUnitOrder(assetSymbol: string): string[] {
  return [assetSymbol, ...FIAT_UNITS.filter((unit) => unit !== assetSymbol)];
}

/** The unit order minus fiat units without a price — a missing rate hides the segment, it never counts as 0. */
export function getAvailableUnits(assetSymbol: string, rates: UnitRates): string[] {
  return getUnitOrder(assetSymbol).filter((unit, index) => index === 0 || rates.has(unit));
}

/** Current prices for one asset from the pricing cache; units without a usable price are left out. */
export function getUnitRates(assetSymbol: string): Map<string, number> {
  const rates = new Map<string, number>();
  const ticker = ASSET_TICKERS.get(assetSymbol);
  if (!ticker) return rates;
  for (const unit of FIAT_UNITS) {
    if (unit === assetSymbol) continue;
    const currency = FIAT_CURRENCIES.get(unit);
    const rate = currency ? pricingService.getExchangeRate(ticker, currency) : undefined;
    if (rate !== undefined && Number.isFinite(rate) && rate > 0) rates.set(unit, rate);
  }
  return rates;
}

/**
 * The amount in asset units (decimal string) for `useSendFlow.send`.
 * Asset unit: the input as is. Fiat unit: input / rate, ROUND_DOWN to the
 * asset's decimals so the wallet never sends more than was typed. `undefined`
 * when nothing can be sent: empty or malformed input, a fiat unit without a
 * rate, or a result that rounds down to zero.
 */
export function toAssetAmount(
  input: string,
  unit: string,
  asset: AmountAsset,
  rate?: number,
): string | undefined {
  const value = parseInput(input);
  if (!value) return undefined;
  let amount = value;
  if (unit !== asset.symbol) {
    if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return undefined;
    amount = value.div(new D(rate));
  }
  const floored = amount.toDecimalPlaces(asset.decimals, DecimalJS.ROUND_DOWN);
  return floored.gt(0) ? floored.toFixed() : undefined;
}

function groupThousands(integerPart: string): string {
  const groups: string[] = [];
  for (let end = integerPart.length; end > 0; end -= 3) {
    groups.unshift(integerPart.slice(Math.max(0, end - 3), end));
  }
  return groups.join("'");
}

function formatFiatValue(value: Dec): string {
  const rounded = value.toDecimalPlaces(FIAT_DECIMALS, DecimalJS.ROUND_HALF_UP);
  const [integerPart = '0', fraction = ''] = rounded.toFixed(FIAT_DECIMALS).split('.');
  return `${groupThousands(integerPart)}.${fraction}`;
}

/**
 * The line under the big number. Typing in the asset unit shows what it is
 * worth in each available fiat unit ("≈ CHF 180.00 · EUR 191.20"); typing in a
 * fiat unit shows the asset amount it buys ("≈ 0.00295 BTC"). `null` when
 * there is no price to show.
 */
export function formatEquivalents(
  input: string,
  unit: string,
  asset: AmountAsset,
  rates: UnitRates,
): string | null {
  const value = parseInput(input) ?? new D(0);
  if (unit === asset.symbol) {
    const parts: string[] = [];
    for (const [fiat, rate] of rates) {
      if (fiat !== asset.symbol) parts.push(`${fiat} ${formatFiatValue(value.mul(rate))}`);
    }
    return parts.length > 0 ? `≈ ${parts.join(' · ')}` : null;
  }
  const rate = rates.get(unit);
  if (rate === undefined) return null;
  const decimals = DISPLAY_DECIMALS.get(asset.symbol) ?? DEFAULT_DISPLAY_DECIMALS;
  const converted = value.div(new D(rate)).toDecimalPlaces(decimals, DecimalJS.ROUND_DOWN);
  return `≈ ${converted.toFixed()} ${asset.symbol}`;
}

/** The typed number for the hero display: empty input reads as 0. */
export function formatInputDisplay(input: string): string {
  return input === '' ? '0' : input;
}

/** `CHF 180` — unit and typed number for the send button; a trailing separator is dropped. */
export function formatAmountLabel(input: string, unit: string): string {
  const number = formatInputDisplay(input).replace(/\.$/, '');
  return `${unit} ${number}`;
}

/**
 * The entered amount for the confirm and success screens: fiat with two
 * decimals and thousands separators ("CHF 1'250.00"), asset amounts without
 * padding ("BTC 0.004").
 */
export function formatEnteredAmount(input: string, unit: string, asset: AmountAsset): string {
  const value = parseInput(input) ?? new D(0);
  if (unit === asset.symbol) return `${unit} ${value.toFixed()}`;
  return `${unit} ${formatFiatValue(value)}`;
}

/** True when the amount is larger than the raw (smallest-unit) balance. Malformed balances never block. */
export function exceedsBalance(assetAmount: string, rawBalance: string, decimals: number): boolean {
  try {
    return BigInt(parseUnits(assetAmount, decimals)) > BigInt(rawBalance);
  } catch {
    return false;
  }
}

/** True when the raw (smallest-unit) balance is above zero. */
export function hasPositiveBalance(rawBalance: string): boolean {
  try {
    return BigInt(rawBalance) > 0n;
  } catch {
    return false;
  }
}

/** `0.0231 BTC` — a raw balance in display units, rounded down to what the symbol needs. */
export function formatBalanceLabel(rawBalance: string, asset: AmountAsset): string {
  const value = parseInput(formatBalance(rawBalance, asset.decimals)) ?? new D(0);
  const decimals = DISPLAY_DECIMALS.get(asset.symbol) ?? DEFAULT_DISPLAY_DECIMALS;
  return `${value.toDecimalPlaces(decimals, DecimalJS.ROUND_DOWN).toFixed()} ${asset.symbol}`;
}
