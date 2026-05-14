import {
  computeFiatValue,
  formatBalance,
  formatCryptoAmount,
  formatFiat,
  formatNumber,
  parseUnits,
  resolveFiatCurrency,
  toNumeric,
} from '../../src/config/portfolio-presentation';
import { FiatCurrency, pricingService } from '../../src/services/pricing-service';

describe('resolveFiatCurrency', () => {
  it('maps the three supported codes to their enum members', () => {
    expect(resolveFiatCurrency('CHF')).toBe(FiatCurrency.CHF);
    expect(resolveFiatCurrency('EUR')).toBe(FiatCurrency.EUR);
    expect(resolveFiatCurrency('USD')).toBe(FiatCurrency.USD);
  });

  it('falls back to USD for any unknown / nullish input', () => {
    expect(resolveFiatCurrency(null)).toBe(FiatCurrency.USD);
    expect(resolveFiatCurrency(undefined)).toBe(FiatCurrency.USD);
    expect(resolveFiatCurrency('')).toBe(FiatCurrency.USD);
    expect(resolveFiatCurrency('JPY')).toBe(FiatCurrency.USD);
    expect(resolveFiatCurrency('chf')).toBe(FiatCurrency.USD); // case-sensitive on purpose
  });
});

describe('formatBalance', () => {
  it('drops trailing zeros from the fractional part', () => {
    expect(formatBalance('1000000000000000000', 18)).toBe('1');
    expect(formatBalance('1500000000000000000', 18)).toBe('1.5');
  });

  it('handles zero balance', () => {
    expect(formatBalance('0', 18)).toBe('0');
    expect(formatBalance('', 18)).toBe('0');
  });

  it('preserves precision past Number.MAX_SAFE_INTEGER via BigInt', () => {
    // 2^53 + 1 in base units — would round to 9007199254740992 if Number-based.
    expect(formatBalance('9007199254740993', 0)).toBe('9007199254740993');
  });

  it('pads short raw amounts with leading zeros in the fractional part', () => {
    // 1 wei = 0.000000000000000001 ETH (18 decimals).
    expect(formatBalance('1', 18)).toBe('0.000000000000000001');
  });

  it('returns the raw input unchanged when it is not a parseable BigInt', () => {
    expect(formatBalance('not-a-number', 18)).toBe('not-a-number');
  });
});

describe('toNumeric', () => {
  it('parses formatted decimals to Number', () => {
    expect(toNumeric('1.5')).toBe(1.5);
    expect(toNumeric('0')).toBe(0);
  });

  it('returns 0 for non-numeric input', () => {
    expect(toNumeric('')).toBe(0);
    expect(toNumeric('abc')).toBe(0);
    expect(toNumeric('NaN')).toBe(0);
  });
});

describe('parseUnits', () => {
  it('scales a whole-number amount to base units', () => {
    expect(parseUnits('1', 6)).toBe('1000000');
    expect(parseUnits('123', 18)).toBe('123000000000000000000');
  });

  it('scales fractional amounts to base units', () => {
    expect(parseUnits('0.5', 18)).toBe('500000000000000000');
    expect(parseUnits('1.000001', 6)).toBe('1000001');
  });

  it('truncates fractional digits past the asset decimals (never sends more than the user typed)', () => {
    // 1.0000001 with 6 decimals → 1.000000 in base units → "1000000".
    expect(parseUnits('1.0000001', 6)).toBe('1000000');
  });

  it('returns "0" for empty / nonsense / dot-only input', () => {
    expect(parseUnits('', 18)).toBe('0');
    expect(parseUnits('.', 18)).toBe('0');
    expect(parseUnits('   ', 18)).toBe('0');
    expect(parseUnits('abc', 18)).toBe('0');
    expect(parseUnits('1e9', 18)).toBe('0'); // scientific notation not allowed
  });

  it('handles a leading dot ".5" as 0.5', () => {
    expect(parseUnits('.5', 6)).toBe('500000');
  });

  it('preserves precision via BigInt past Number.MAX_SAFE_INTEGER', () => {
    expect(parseUnits('1000000000000', 18)).toBe('1000000000000000000000000000000');
  });
});

describe('formatNumber', () => {
  it('returns "0" for zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('uses two fixed decimals for values >= 1', () => {
    expect(formatNumber(1)).toBe('1.00');
    expect(formatNumber(1.5)).toBe('1.50');
    expect(formatNumber(1234.567)).toBe('1234.57');
  });

  it('strips trailing zeros for sub-1 values', () => {
    expect(formatNumber(0.5)).toBe('0.5');
    expect(formatNumber(0.0001)).toBe('0.0001');
  });

  it('respects the maxFractionDigits ceiling for very small numbers', () => {
    expect(formatNumber(0.0000000001, 8)).toBe('0');
  });
});

describe('formatFiat', () => {
  it('always emits two decimals with CH thousands separator', () => {
    expect(formatFiat(1234.56)).toBe('1’234.56');
    expect(formatFiat(0)).toBe('0.00');
  });

  it('returns "0.00" for non-finite input', () => {
    expect(formatFiat(NaN)).toBe('0.00');
    expect(formatFiat(Infinity)).toBe('0.00');
  });
});

describe('formatCryptoAmount', () => {
  it('emits up to 8 fractional digits with CH thousands separator', () => {
    expect(formatCryptoAmount(0.12345678)).toBe('0.12345678');
    expect(formatCryptoAmount(1234.5)).toBe('1’234.5');
  });

  it('returns "0" for non-finite input', () => {
    expect(formatCryptoAmount(NaN)).toBe('0');
  });
});

describe('computeFiatValue', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 0 for a zero balance regardless of currency / pricing state', () => {
    expect(computeFiatValue(0, 'BTC', FiatCurrency.USD, true)).toBe(0);
    expect(computeFiatValue(0, 'USD', FiatCurrency.USD, false)).toBe(0);
  });

  it('short-circuits for stablecoins held in the matching fiat (no rate lookup)', () => {
    // Even with pricing not ready, USD-in-USD must return the balance.
    expect(computeFiatValue(100, 'USD', FiatCurrency.USD, false)).toBe(100);
    expect(computeFiatValue(50, 'CHF', FiatCurrency.CHF, false)).toBe(50);
    expect(computeFiatValue(75, 'EUR', FiatCurrency.EUR, true)).toBe(75);
  });

  it('shows the par balance for any stablecoin pre-init so the dashboard does not flash zero', () => {
    expect(computeFiatValue(100, 'USD', FiatCurrency.CHF, false)).toBe(100);
    expect(computeFiatValue(100, 'EUR', FiatCurrency.CHF, false)).toBe(100);
  });

  it('returns 0 for non-stable assets when pricing is not ready', () => {
    expect(computeFiatValue(1, 'BTC', FiatCurrency.USD, false)).toBe(0);
    expect(computeFiatValue(2, 'ETH', FiatCurrency.EUR, false)).toBe(0);
  });

  it('multiplies the balance by the pricing-service rate when ready', () => {
    const spy = jest.spyOn(pricingService, 'getExchangeRate').mockReturnValue(50_000);
    expect(computeFiatValue(2, 'BTC', FiatCurrency.USD, true)).toBe(100_000);
    expect(spy).toHaveBeenCalledWith('btc', FiatCurrency.USD);
  });

  it('returns 0 if the pricing service has no rate for the ticker', () => {
    jest.spyOn(pricingService, 'getExchangeRate').mockReturnValue(null);
    expect(computeFiatValue(2, 'BTC', FiatCurrency.USD, true)).toBe(0);
  });

  it('returns 0 for an unknown canonical symbol', () => {
    // No SYMBOL_TO_TICKER entry → no rate lookup, falls through to 0.
    expect(computeFiatValue(2, 'XYZ', FiatCurrency.USD, true)).toBe(0);
  });
});
