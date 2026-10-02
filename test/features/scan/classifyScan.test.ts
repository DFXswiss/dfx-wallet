import { classifyScan, parseBitcoinAmount } from '../../../src/features/scan/classifyScan';

// BIP-173 reference address (whitelisted fixture, see eslint.config.js).
const BTC = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const EVM = `0x${'ab12'.repeat(10)}`;

describe('parseBitcoinAmount', () => {
  it('accepts only positive decimal values with at most eight decimal places', () => {
    expect(parseBitcoinAmount('1.12345678')).toBe('1.12345678');
    expect(parseBitcoinAmount('0')).toBeUndefined();
    expect(parseBitcoinAmount('-1')).toBeUndefined();
    expect(parseBitcoinAmount('1.123456789')).toBeUndefined();
    expect(parseBitcoinAmount('not-a-number')).toBeUndefined();
    expect(parseBitcoinAmount(undefined)).toBeUndefined();
  });
});

describe('classifyScan', () => {
  it('recognises a bare LNURL as OpenCryptoPay', () => {
    expect(classifyScan('lnurl1abc')).toEqual({ kind: 'ocp', lnurl: 'lnurl1abc' });
  });

  it('gives OpenCryptoPay precedence for BIP-21 with a lightning LNURL', () => {
    const data = `bitcoin:${BTC}?lightning=lnurl1xyz`;
    expect(classifyScan(data)).toEqual({ kind: 'ocp', lnurl: data });
  });

  it('recognises a bare Bitcoin address', () => {
    expect(classifyScan(BTC)).toEqual({ kind: 'address', address: BTC });
  });

  it('returns a valid BIP-21 amount with its Bitcoin address', () => {
    expect(classifyScan(`bitcoin:${BTC}?amount=0.001`)).toEqual({
      kind: 'address',
      address: BTC,
      amount: '0.001',
    });
  });

  it.each(['0', '-1', '1.123456789', 'not-a-number'])(
    'ignores the invalid BIP-21 amount %s',
    (amount) => {
      expect(classifyScan(`bitcoin:${BTC}?amount=${amount}`)).toEqual({
        kind: 'address',
        address: BTC,
      });
    },
  );

  it('recognises bare and ethereum-scheme EVM addresses', () => {
    expect(classifyScan(EVM)).toEqual({ kind: 'address', address: EVM });
    expect(classifyScan(`ethereum:${EVM}?amount=1`)).toEqual({
      kind: 'address',
      address: EVM,
    });
  });

  it('compacts an IBAN containing spaces', () => {
    expect(classifyScan('CH93 0076 2011 6238 5295 7')).toEqual({
      kind: 'iban',
      iban: 'CH9300762011623852957',
    });
  });

  it('returns unrecognised input unchanged', () => {
    expect(classifyScan('some-payload')).toEqual({ kind: 'unknown', data: 'some-payload' });
  });
});
