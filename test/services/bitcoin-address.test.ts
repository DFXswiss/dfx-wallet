import {
  decodeSparkAddress,
  encodeSparkAddress,
  type NetworkType,
} from '@buildonspark/spark-sdk';
import { bech32, bech32m, type BechLib } from 'bech32';
import bs58check from 'bs58check';

import { isBitcoinOnChainAddress, isSparkMainnetAddress } from '@/services/bitcoin-address';

// eslint-disable-next-line no-secrets/no-secrets -- public BIP-173 test vector, not a credential
const BITCOIN_V0 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const BITCOIN_V1 = 'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y';
// eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin address, not a credential
const MAINNET_P2PKH = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
// eslint-disable-next-line no-secrets/no-secrets -- public Bitcoin address, not a credential
const MAINNET_P2SH = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';

const SPARK_MAINNET_NETWORK: NetworkType = 'MAINNET';
const SPARK_G =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SPARK_2G =
  '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';
const SPARK_3G =
  '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const SPARK_NEGATIVE_G =
  '0379be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SPARK_NEGATIVE_2G =
  '03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';
const SPARK_PUBLIC_KEY_VECTORS = [
  ['G (even)', SPARK_G],
  ['2G (even)', SPARK_2G],
  ['3G (even)', SPARK_3G],
  ['-G (odd)', SPARK_NEGATIVE_G],
  ['-2G (odd)', SPARK_NEGATIVE_2G],
] as const;
const SPARK_ADDRESS = encodeSparkAddress({
  identityPublicKey: SPARK_G,
  network: SPARK_MAINNET_NETWORK,
});
const SHORT_SPARK_ADDRESS = bech32m.encode(
  'sp',
  bech32m.decode(SPARK_ADDRESS, 1023).words,
  1023,
);

function encodeWitness(encoding: BechLib, version: number, programLength: number): string {
  const program = new Uint8Array(programLength).map((_, index) => index + 1);
  return encoding.encode('bc', [version, ...encoding.toWords(program)]);
}

function changeLastCharacter(value: string): string {
  const replacement = value.endsWith('q') ? 'p' : 'q';
  return `${value.slice(0, -1)}${replacement}`;
}

function hexToBytes(value: string): Uint8Array {
  return Uint8Array.from({ length: value.length / 2 }, (_, index) =>
    Number.parseInt(value.slice(index * 2, index * 2 + 2), 16),
  );
}

function encodeSparkPayload(identityPublicKey: Uint8Array, trailingBytes: number[] = []): string {
  const payload = Uint8Array.from([0x0a, 0x21, ...identityPublicKey, ...trailingBytes]);
  return bech32m.encode('spark', bech32m.toWords(payload), 1023);
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
  it.each(SPARK_PUBLIC_KEY_VECTORS)(
    'accepts an SDK-encoded address for public key %s',
    (_label, identityPublicKey) => {
      const address = encodeSparkAddress({
        identityPublicKey,
        network: SPARK_MAINNET_NETWORK,
      });

      expect(isSparkMainnetAddress(address)).toBe(true);
    },
  );

  it.each(SPARK_PUBLIC_KEY_VECTORS)(
    'matches the SDK plain-address decoder for public key %s',
    (_label, identityPublicKey) => {
      const address = encodeSparkAddress({
        identityPublicKey,
        network: SPARK_MAINNET_NETWORK,
      });
      let sdkAcceptsPlainAddress = false;
      try {
        const decoded = decodeSparkAddress(address, SPARK_MAINNET_NETWORK);
        sdkAcceptsPlainAddress = decoded.sparkInvoiceFields === undefined;
      } catch {
        sdkAcceptsPlainAddress = false;
      }

      expect(isSparkMainnetAddress(address)).toBe(sdkAcceptsPlainAddress);
    },
  );

  it.each([SPARK_ADDRESS.toUpperCase(), SHORT_SPARK_ADDRESS])(
    'accepts valid Spark mainnet address %s',
    (address) => {
      expect(isSparkMainnetAddress(address)).toBe(true);
    },
  );

  it('rejects a checksum-valid Spark payload whose x-coordinate is outside the field', () => {
    // A secp256k1 x-coordinate must satisfy 0 <= x < p, so x = p is not a point.
    const fieldModulus =
      'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f';
    const invalidAddress = encodeSparkPayload(
      Uint8Array.from([0x02, ...hexToBytes(fieldModulus)]),
    );

    expect(isSparkMainnetAddress(invalidAddress)).toBe(false);
  });

  it('rejects a checksum-valid Spark payload with a trailing signature field', () => {
    const addressWithSignature = encodeSparkPayload(hexToBytes(SPARK_G), [0x1a, 0x01, 0x00]);

    expect(isSparkMainnetAddress(addressWithSignature)).toBe(false);
  });

  it.each<[string, number, number]>([
    ['invoice-field tag', 0x12, 0x21],
    ['signature-field tag', 0x1a, 0x21],
    ['wrong identity-key length', 0x0a, 0x20],
  ])('rejects a checksum-valid payload with %s', (_label, tag, length) => {
    const payload = Uint8Array.from([tag, length, ...hexToBytes(SPARK_G)]);
    const address = bech32m.encode('spark', bech32m.toWords(payload), 1023);

    expect(isSparkMainnetAddress(address)).toBe(false);
  });

  it('rejects a Spark invoice address for a plain transfer', () => {
    const invoiceAddress = encodeSparkAddress({
      identityPublicKey: SPARK_G,
      network: SPARK_MAINNET_NETWORK,
      sparkInvoiceFields: {
        version: 1,
        id: new Uint8Array(16),
        paymentType: { $case: 'satsPayment', satsPayment: { amount: 1_000 } },
      },
    });

    expect(isSparkMainnetAddress(invoiceAddress)).toBe(false);
  });

  it('rejects a one-character checksum mutation', () => {
    expect(isSparkMainnetAddress(changeLastCharacter(SPARK_ADDRESS))).toBe(false);
  });

  it.each<NetworkType>(['TESTNET', 'REGTEST', 'SIGNET', 'LOCAL'])(
    'rejects an SDK-encoded %s Spark address',
    (network) => {
      const nonMainnetAddress = encodeSparkAddress({
        identityPublicKey: SPARK_G,
        network,
      });

      expect(isSparkMainnetAddress(nonMainnetAddress)).toBe(false);
    },
  );

  it('rejects the Spark payload when encoded as Bech32 instead of Bech32m', () => {
    const wrongEncoding = bech32.encode(
      'spark',
      bech32m.decode(SPARK_ADDRESS, 1023).words,
      1023,
    );

    expect(isSparkMainnetAddress(wrongEncoding)).toBe(false);
  });

  it('rejects mixed-case Spark addresses', () => {
    const mixedCase = `${SPARK_ADDRESS[0]!.toUpperCase()}${SPARK_ADDRESS.slice(1)}`;

    expect(isSparkMainnetAddress(mixedCase)).toBe(false);
  });
});
