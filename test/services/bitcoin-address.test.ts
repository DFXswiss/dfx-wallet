import { bech32, bech32m, type BechLib } from 'bech32';
import bs58check from 'bs58check';

import { isBitcoinOnChainAddress, isSparkMainnetAddress } from '@/services/bitcoin-address';

// eslint-disable-next-line no-secrets/no-secrets -- public BIP-173 test vector, not a credential
const BITCOIN_V0 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
 
const BITCOIN_V1 =
  'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y';
// eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin address, not a credential
const MAINNET_P2PKH = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
// eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin address, not a credential
const MAINNET_P2SH = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';

const SPARK_PAYLOAD = new Uint8Array(33).map((_, index) => index);
const SPARK_ADDRESS = bech32m.encode('spark', bech32m.toWords(SPARK_PAYLOAD), 1023);
const SHORT_SPARK_ADDRESS = bech32m.encode('sp', bech32m.toWords(SPARK_PAYLOAD), 1023);

function encodeWitness(encoding: BechLib, version: number, programLength: number): string {
  const program = new Uint8Array(programLength).map((_, index) => index + 1);
  return encoding.encode('bc', [version, ...encoding.toWords(program)]);
}

function changeLastCharacter(value: string): string {
  const replacement = value.endsWith('q') ? 'p' : 'q';
  return `${value.slice(0, -1)}${replacement}`;
}

describe('isBitcoinOnChainAddress', () => {
  it.each([
    BITCOIN_V0,
    BITCOIN_V0.toUpperCase(),
    BITCOIN_V1,
    MAINNET_P2PKH,
    MAINNET_P2SH,
    encodeWitness(bech32, 0, 32),
    encodeWitness(bech32m, 1, 2),
    encodeWitness(bech32m, 16, 40),
  ])('accepts checksum-valid mainnet on-chain address %s', (address) => {
    expect(isBitcoinOnChainAddress(address)).toBe(true);
  });

  it.each([
    changeLastCharacter(BITCOIN_V0),
    changeLastCharacter(BITCOIN_V1),
    changeLastCharacter(MAINNET_P2PKH),
    changeLastCharacter(MAINNET_P2SH),
  ])('rejects address with a one-character checksum mutation %s', (address) => {
    expect(isBitcoinOnChainAddress(address)).toBe(false);
  });

  it('rejects checksum-valid SegWit addresses with a non-mainnet HRP', () => {
    const testnetV0 = bech32.encode('tb', bech32.decode(BITCOIN_V0).words);
    const testnetV1 = bech32m.encode('tb', bech32m.decode(BITCOIN_V1).words);

    expect(isBitcoinOnChainAddress(testnetV0)).toBe(false);
    expect(isBitcoinOnChainAddress(testnetV1)).toBe(false);
  });

  it('enforces the checksum encoding required by the witness version', () => {
    const v0AsBech32m = bech32m.encode('bc', bech32.decode(BITCOIN_V0).words);
    const v1AsBech32 = bech32.encode('bc', bech32m.decode(BITCOIN_V1).words);

    expect(isBitcoinOnChainAddress(v0AsBech32m)).toBe(false);
    expect(isBitcoinOnChainAddress(v1AsBech32)).toBe(false);
  });

  it.each([
    encodeWitness(bech32, 0, 21),
    encodeWitness(bech32m, 1, 1),
    encodeWitness(bech32m, 1, 41),
    encodeWitness(bech32m, 17, 32),
  ])('rejects invalid witness versions or program lengths %s', (address) => {
    expect(isBitcoinOnChainAddress(address)).toBe(false);
  });

  it('rejects mixed-case SegWit addresses', () => {
    const mixedCase = `${BITCOIN_V0.slice(0, 4).toUpperCase()}${BITCOIN_V0.slice(4)}`;

    expect(isBitcoinOnChainAddress(mixedCase)).toBe(false);
  });

  it.each([
     
    'tb1qw508d6qejxtdg4y5r3zarvary0c5xw508d6qejxtdg4y5r3zarvary0c5xw7k7grplx',
    // eslint-disable-next-line no-secrets/no-secrets -- public BIP-173 invalid test vector, not a credential
    'bc1zw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    // eslint-disable-next-line no-secrets/no-secrets -- public BIP-173 invalid test vector, not a credential
    'bc1qr508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    // eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin testnet address, not a credential
    'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
     
    'n2eMqTT929pb1RDNuqEnxdaLau1rxy3efi',
     
    '2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br',
  ])('rejects public invalid or testnet vector %s', (address) => {
    expect(isBitcoinOnChainAddress(address)).toBe(false);
  });

  it('rejects Base58Check payloads with the wrong length or version', () => {
    const shortMainnetPayload = bs58check.encode(Uint8Array.from([0x00, ...new Uint8Array(19)]));
    const testnetPayload = bs58check.encode(Uint8Array.from([0x6f, ...new Uint8Array(20)]));

    expect(isBitcoinOnChainAddress(shortMainnetPayload)).toBe(false);
    expect(isBitcoinOnChainAddress(testnetPayload)).toBe(false);
  });

  it.each(['', 'spark:123', '0x0000000000000000000000000000000000000000', '1O0Il-not-base58'])(
    'rejects non-Bitcoin value %s',
    (address) => {
      expect(isBitcoinOnChainAddress(address)).toBe(false);
    },
  );
});

describe('isSparkMainnetAddress', () => {
  it.each([SPARK_ADDRESS, SPARK_ADDRESS.toUpperCase(), SHORT_SPARK_ADDRESS])(
    'accepts checksum-valid Spark mainnet address %s',
    (address) => {
      expect(isSparkMainnetAddress(address)).toBe(true);
    },
  );

  it('accepts a checksum-valid Spark address beyond the default Bech32 length limit', () => {
    const longPayload = new Uint8Array(100).map((_, index) => index);
    const longAddress = bech32m.encode('spark', bech32m.toWords(longPayload), 1023);

    expect(isSparkMainnetAddress(longAddress)).toBe(true);
  });

  it('rejects a one-character checksum mutation', () => {
    expect(isSparkMainnetAddress(changeLastCharacter(SPARK_ADDRESS))).toBe(false);
  });

  it('rejects a checksum-valid address with the wrong HRP', () => {
    const wrongHrp = bech32m.encode('sparkt', bech32m.toWords(SPARK_PAYLOAD), 1023);

    expect(isSparkMainnetAddress(wrongHrp)).toBe(false);
  });

  it('rejects the Spark payload when encoded as Bech32 instead of Bech32m', () => {
    const wrongEncoding = bech32.encode('spark', bech32.toWords(SPARK_PAYLOAD), 1023);

    expect(isSparkMainnetAddress(wrongEncoding)).toBe(false);
  });

  it('rejects mixed-case Spark addresses', () => {
    const mixedCase = `${SPARK_ADDRESS[0]!.toUpperCase()}${SPARK_ADDRESS.slice(1)}`;

    expect(isSparkMainnetAddress(mixedCase)).toBe(false);
  });
});
