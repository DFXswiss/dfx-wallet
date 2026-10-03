import { isBitcoinOnChainAddress, isSparkMainnetAddress } from '@/services/bitcoin-address';

describe('isBitcoinOnChainAddress', () => {
  it.each([
    // eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin test vector, not a credential
    'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    // eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin test vector, not a credential
    'BC1QXY2KGDYGJRSQTZQ2N0YRF2493P83KKFJHX0WLH',
    'bc1p5cyxnuxmeuwuvkwfem96llyxf8p8v5s4x7l0w7',
    // eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin test vector, not a credential
    '1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
    // eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin test vector, not a credential
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
  ])('accepts mainnet on-chain address %s', (address) => {
    expect(isBitcoinOnChainAddress(address)).toBe(true);
  });

  it.each([
    '',
    'spark:123',
    '0x0000000000000000000000000000000000000000',
    // eslint-disable-next-line no-secrets/no-secrets -- deliberately invalid public Bitcoin test vector
    'bc1Qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    // eslint-disable-next-line no-secrets/no-secrets -- deliberately invalid public Bitcoin test vector
    'bc1zxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    'tb1qfm7d7yv7l4ye7z2k4v3j6u7s2f2z8x5v2w5q4p',
    // eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin test vector, not a credential
    'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
    'n2eMqTT929pb1RDNuqEnxdaLau1rxy3efi',
    '2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br',
    '1O0Il-not-base58',
  ])('rejects non-mainnet address %s', (address) => {
    expect(isBitcoinOnChainAddress(address)).toBe(false);
  });
});

describe('isSparkMainnetAddress', () => {
  it.each([`spark1${'q'.repeat(40)}`, `sp1${'023456789ac'.repeat(4)}`])(
    'accepts Spark mainnet address %s',
    (address) => {
      expect(isSparkMainnetAddress(address)).toBe(true);
    },
  );

  it.each([
    `sparkt1${'q'.repeat(40)}`,
    `sparkrt1${'q'.repeat(40)}`,
    `sparks1${'q'.repeat(40)}`,
    `sparkl1${'q'.repeat(40)}`,
    `sprt1${'q'.repeat(40)}`,
    `spt1${'q'.repeat(40)}`,
    `sps1${'q'.repeat(40)}`,
    `spl1${'q'.repeat(40)}`,
    `spark1${'q'.repeat(39)}`,
    `spark1${'q'.repeat(20)}A${'q'.repeat(19)}`,
    `spark1${'q'.repeat(20)}b${'q'.repeat(19)}`,
    `spark1${'q'.repeat(20)}i${'q'.repeat(19)}`,
    `spark1${'q'.repeat(20)}o${'q'.repeat(19)}`,
    `spark1${'q'.repeat(20)}1${'q'.repeat(19)}`,
  ])('rejects non-mainnet or malformed Spark address %s', (address) => {
    expect(isSparkMainnetAddress(address)).toBe(false);
  });
});
