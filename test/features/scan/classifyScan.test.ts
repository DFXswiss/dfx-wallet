import { encodeSparkAddress } from '@buildonspark/spark-sdk';
import { getIcapAddress, ZeroAddress } from 'ethers';

import { classifyScan, parseBitcoinAmount } from '../../../src/features/scan/classifyScan';

// BIP-173 reference address (whitelisted fixture, see eslint.config.js).
const BTC = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const EVM = `0x${'ab12'.repeat(10)}`;
const SPARK_G = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SPARK = encodeSparkAddress({ identityPublicKey: SPARK_G, network: 'MAINNET' });
const ZERO = `0x${'0'.repeat(40)}`;
const ARBITRARY = 'raw-non-opencryptopay-payment-data';

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

  it('recognises a plain Spark mainnet address', () => {
    expect(classifyScan(SPARK)).toEqual({ kind: 'address', address: SPARK });
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
    expect(classifyScan(ARBITRARY)).toEqual({ kind: 'unknown', data: ARBITRARY });
    expect(classifyScan('a'.repeat(26))).toEqual({ kind: 'unknown', data: 'a'.repeat(26) });
  });

  it('rejects the EVM zero address instead of opening send', () => {
    const icap = getIcapAddress(ZeroAddress);
    expect(classifyScan(ZERO)).toEqual({ kind: 'unknown', data: ZERO });
    expect(classifyScan(`ethereum:${ZERO}`)).toEqual({
      kind: 'unknown',
      data: `ethereum:${ZERO}`,
    });
    expect(classifyScan(ZERO.slice(2))).toEqual({ kind: 'unknown', data: ZERO.slice(2) });
    expect(classifyScan(icap)).toEqual({ kind: 'unknown', data: icap });
  });
});
