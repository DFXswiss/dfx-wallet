import { FiatCurrency, pricingService } from '@/services/pricing-service';
import type { AmountKey } from '@/components/AmountKeypad';
import {
  applyKey,
  exceedsBalance,
  formatAmountLabel,
  formatBalanceLabel,
  formatEnteredAmount,
  formatEquivalents,
  formatInputDisplay,
  getAvailableUnits,
  getUnitOrder,
  getUnitRates,
  hasPositiveBalance,
  maxDecimalsFor,
  toAssetAmount,
} from '@/features/transfer/amount';

const BTC = { symbol: 'BTC', decimals: 8 };
const ZCHF = { symbol: 'CHF', decimals: 18 };

const press = (keys: AmountKey[], maxDecimals: number, start = ''): string =>
  keys.reduce((input, key) => applyKey(input, key, maxDecimals), start);

describe('applyKey', () => {
  it('appends digits and one decimal separator', () => {
    expect(press(['1', '2', '.', '5'], 8)).toBe('12.5');
  });

  it('ignores a second decimal separator', () => {
    expect(press(['1', '.', '5', '.', '2'], 8)).toBe('1.52');
  });

  it('starts a fraction with a leading zero', () => {
    expect(press(['.'], 8)).toBe('0.');
    expect(press(['.', '5'], 8)).toBe('0.5');
  });

  it('never keeps leading zeros', () => {
    expect(press(['0', '0', '0'], 8)).toBe('0');
    expect(press(['0', '7'], 8)).toBe('7');
    expect(press(['0', '.', '0', '7'], 8)).toBe('0.07');
  });

  it('caps the fraction at the unit decimals: 2 for fiat', () => {
    expect(press(['1', '.', '2', '3', '4'], 2)).toBe('1.23');
  });

  it('caps the fraction at the unit decimals: 8 for BTC, and allows exactly 8', () => {
    expect(press(['0', '.', '1', '2', '3', '4', '5', '6', '7', '8'], 8)).toBe('0.12345678');
    expect(press(['0', '.', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 8)).toBe('0.12345678');
  });

  it('ignores the separator when the unit has no decimals', () => {
    expect(press(['1', '.', '2'], 0)).toBe('12');
  });

  it('bounds the integer part', () => {
    const twelve = '123456789012';
    expect(applyKey(twelve, '3', 2)).toBe(twelve);
    expect(applyKey(twelve, '.', 2)).toBe('123456789012.');
  });

  it('deletes one character at a time down to empty', () => {
    expect(press(['del'], 2, '12')).toBe('1');
    expect(press(['del', 'del'], 2, '12')).toBe('');
    expect(press(['del'], 2, '')).toBe('');
    expect(press(['del'], 2, '0.')).toBe('0');
  });
});

describe('maxDecimalsFor', () => {
  it('uses the asset decimals for the asset unit and 2 for fiat units', () => {
    expect(maxDecimalsFor('BTC', BTC)).toBe(8);
    expect(maxDecimalsFor('CHF', BTC)).toBe(2);
    expect(maxDecimalsFor('EUR', BTC)).toBe(2);
    expect(maxDecimalsFor('CHF', ZCHF)).toBe(18);
    expect(maxDecimalsFor('EUR', ZCHF)).toBe(2);
  });
});

describe('unit order', () => {
  it('puts the asset first, then CHF, then EUR', () => {
    expect(getUnitOrder('BTC')).toEqual(['BTC', 'CHF', 'EUR']);
  });

  it('shows a CHF stablecoin as CHF | EUR without a duplicate', () => {
    expect(getUnitOrder('CHF')).toEqual(['CHF', 'EUR']);
  });

  it('shows a EUR stablecoin as EUR | CHF', () => {
    expect(getUnitOrder('EUR')).toEqual(['EUR', 'CHF']);
  });

  it('shows a USD stablecoin as USD | CHF | EUR', () => {
    expect(getUnitOrder('USD')).toEqual(['USD', 'CHF', 'EUR']);
  });

  it('hides a fiat unit without a rate but never the asset itself', () => {
    expect(getAvailableUnits('BTC', new Map([['CHF', 61000]]))).toEqual(['BTC', 'CHF']);
    expect(getAvailableUnits('BTC', new Map([['EUR', 57000]]))).toEqual(['BTC', 'EUR']);
    expect(getAvailableUnits('BTC', new Map())).toEqual(['BTC']);
    expect(getAvailableUnits('CHF', new Map())).toEqual(['CHF']);
  });
});

describe('getUnitRates', () => {
  const prices = new Map<string, number | undefined>();
  let spy: jest.SpyInstance;

  beforeEach(() => {
    prices.clear();
    spy = jest
      .spyOn(pricingService, 'getExchangeRate')
      .mockImplementation((ticker, currency) => prices.get(`${ticker}:${currency}`));
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('prices BTC through btc in CHF and EUR', () => {
    prices.set('btc:CHF', 61000);
    prices.set('btc:EUR', 57000);
    expect(Array.from(getUnitRates('BTC'))).toEqual([
      ['CHF', 61000],
      ['EUR', 57000],
    ]);
    expect(spy).toHaveBeenCalledWith('btc', FiatCurrency.CHF);
    expect(spy).toHaveBeenCalledWith('btc', FiatCurrency.EUR);
  });

  it('prices stablecoins through their token, skipping the unit that is the asset', () => {
    prices.set('zchf:EUR', 1.05);
    prices.set('deuro:CHF', 0.95);
    prices.set('usdt:CHF', 0.8);
    prices.set('usdt:EUR', 0.85);
    expect(Array.from(getUnitRates('CHF'))).toEqual([['EUR', 1.05]]);
    expect(Array.from(getUnitRates('EUR'))).toEqual([['CHF', 0.95]]);
    expect(Array.from(getUnitRates('USD'))).toEqual([
      ['CHF', 0.8],
      ['EUR', 0.85],
    ]);
    expect(spy).not.toHaveBeenCalledWith('zchf', FiatCurrency.CHF);
    expect(spy).not.toHaveBeenCalledWith('deuro', FiatCurrency.EUR);
  });

  it('leaves out units without a usable price instead of treating them as 0', () => {
    prices.set('btc:CHF', 0);
    prices.set('btc:EUR', Number.NaN);
    expect(getUnitRates('BTC').size).toBe(0);
    prices.set('btc:CHF', -1);
    expect(getUnitRates('BTC').size).toBe(0);
  });

  it('returns no rates for a symbol without a ticker', () => {
    expect(getUnitRates('XYZ').size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('toAssetAmount', () => {
  it('rounds a fiat amount DOWN to the asset decimals (never more than typed)', () => {
    // 180 / 61000 = 0.002950819672131147...  -> ...81 (rounding up would give ...82)
    expect(toAssetAmount('180', 'CHF', BTC, 61000)).toBe('0.00295081');
  });

  it('is exact where the division is exact', () => {
    expect(toAssetAmount('61000', 'CHF', BTC, 61000)).toBe('1');
    expect(toAssetAmount('30500', 'CHF', BTC, 61000)).toBe('0.5');
  });

  it('keeps 18-decimal assets exact instead of losing digits to floats', () => {
    // 1 EUR / 1.05 = 0.952380952380952380952...
    expect(toAssetAmount('1', 'EUR', ZCHF, 1.05)).toBe('0.95238095238095238');
  });

  it('passes the asset unit through unchanged', () => {
    expect(toAssetAmount('0.5', 'BTC', BTC)).toBe('0.5');
    expect(toAssetAmount('0.3', 'BTC', BTC)).toBe('0.3');
    expect(toAssetAmount('1.', 'BTC', BTC)).toBe('1');
    expect(toAssetAmount('0.10', 'BTC', BTC)).toBe('0.1');
  });

  it('does not need a rate for the asset unit', () => {
    expect(toAssetAmount('2', 'BTC', BTC, undefined)).toBe('2');
  });

  it('returns undefined for empty, zero or malformed input', () => {
    expect(toAssetAmount('', 'BTC', BTC)).toBeUndefined();
    expect(toAssetAmount('0', 'BTC', BTC)).toBeUndefined();
    expect(toAssetAmount('0.', 'BTC', BTC)).toBeUndefined();
    expect(toAssetAmount('abc', 'BTC', BTC)).toBeUndefined();
    expect(toAssetAmount('-1', 'BTC', BTC)).toBeUndefined();
  });

  it('returns undefined for a fiat unit without a usable rate', () => {
    expect(toAssetAmount('180', 'CHF', BTC)).toBeUndefined();
    expect(toAssetAmount('180', 'CHF', BTC, 0)).toBeUndefined();
    expect(toAssetAmount('180', 'CHF', BTC, -5)).toBeUndefined();
    expect(toAssetAmount('180', 'CHF', BTC, Number.NaN)).toBeUndefined();
    expect(toAssetAmount('180', 'CHF', BTC, Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('returns undefined when the amount rounds down to nothing', () => {
    expect(toAssetAmount('0.01', 'CHF', BTC, 1_000_000_000)).toBeUndefined();
  });
});

describe('formatEquivalents', () => {
  const rates = new Map([
    ['CHF', 61000],
    ['EUR', 57000],
  ]);

  it('shows every fiat value when typing in the asset unit', () => {
    expect(formatEquivalents('0.004', 'BTC', BTC, rates)).toBe('≈ CHF 244.00 · EUR 228.00');
  });

  it('shows the asset amount, rounded down, when typing in a fiat unit', () => {
    expect(formatEquivalents('180', 'CHF', BTC, rates)).toBe('≈ 0.00295081 BTC');
    expect(formatEquivalents('180', 'EUR', BTC, rates)).toBe('≈ 0.00315789 BTC');
  });

  it('reads an empty input as zero', () => {
    expect(formatEquivalents('', 'CHF', BTC, rates)).toBe('≈ 0 BTC');
    expect(formatEquivalents('', 'BTC', BTC, rates)).toBe('≈ CHF 0.00 · EUR 0.00');
  });

  it('is null when there is no price to show', () => {
    expect(formatEquivalents('1', 'BTC', BTC, new Map())).toBeNull();
    expect(formatEquivalents('1', 'EUR', BTC, new Map([['CHF', 61000]]))).toBeNull();
  });

  it('skips the fiat unit that is the asset itself', () => {
    expect(formatEquivalents('100', 'CHF', ZCHF, new Map([['EUR', 1.05]]))).toBe('≈ EUR 105.00');
  });

  it('shows stablecoin amounts with two decimals', () => {
    const usd = { symbol: 'USD', decimals: 6 };
    expect(formatEquivalents('100', 'CHF', usd, new Map([['CHF', 0.8]]))).toBe('≈ 125 USD');
  });

  it('groups thousands and rounds half up without float error', () => {
    expect(formatEquivalents('1500', 'BTC', BTC, new Map([['CHF', 61000]]))).toBe(
      "≈ CHF 91'500'000.00",
    );
    // 1.005 * 1 in floats is 1.00; as a decimal it is exactly 1.005 -> 1.01.
    expect(formatEquivalents('1.005', 'BTC', BTC, new Map([['CHF', 1]]))).toBe('≈ CHF 1.01');
  });
});

describe('labels', () => {
  it('formatInputDisplay reads empty as 0', () => {
    expect(formatInputDisplay('')).toBe('0');
    expect(formatInputDisplay('12.5')).toBe('12.5');
  });

  it('formatAmountLabel puts the unit first and drops a trailing separator', () => {
    expect(formatAmountLabel('180', 'CHF')).toBe('CHF 180');
    expect(formatAmountLabel('180.', 'CHF')).toBe('CHF 180');
    expect(formatAmountLabel('', 'BTC')).toBe('BTC 0');
  });

  it('formatEnteredAmount pads fiat to two decimals and leaves asset amounts alone', () => {
    expect(formatEnteredAmount('180', 'CHF', BTC)).toBe('CHF 180.00');
    expect(formatEnteredAmount('1250', 'EUR', BTC)).toBe("EUR 1'250.00");
    expect(formatEnteredAmount('0.0040', 'BTC', BTC)).toBe('BTC 0.004');
    expect(formatEnteredAmount('', 'CHF', BTC)).toBe('CHF 0.00');
  });
});

describe('balance helpers', () => {
  it('exceedsBalance compares in smallest units', () => {
    expect(exceedsBalance('1', '99999999', 8)).toBe(true);
    expect(exceedsBalance('1', '100000000', 8)).toBe(false);
    expect(exceedsBalance('0.00000001', '0', 8)).toBe(true);
  });

  it('exceedsBalance never blocks on a malformed balance', () => {
    expect(exceedsBalance('1', 'not-a-number', 8)).toBe(false);
  });

  it('hasPositiveBalance', () => {
    expect(hasPositiveBalance('1')).toBe(true);
    expect(hasPositiveBalance('0')).toBe(false);
    expect(hasPositiveBalance('')).toBe(false);
    expect(hasPositiveBalance('x')).toBe(false);
  });

  it('formatBalanceLabel rounds down to what the symbol needs', () => {
    expect(formatBalanceLabel('2310000', BTC)).toBe('0.0231 BTC');
    expect(formatBalanceLabel('0', BTC)).toBe('0 BTC');
    expect(formatBalanceLabel('1239999999999999999', ZCHF)).toBe('1.23 CHF');
  });
});
