/**
 * Property-based + vector-based tests for the EIP-55 checksum address service.
 *
 * Properties (fast-check):
 * - checksumming is idempotent
 * - any casing of the same 20 bytes (lower / upper / random mixed) normalizes
 *   to the identical checksummed output
 * - the output preserves the hex digits and the canonical shape
 * - it agrees with ethers' getAddress (independent reference implementation)
 * - invalid prefix / length / characters are rejected with the typed error
 *
 * Vectors: the official examples from EIP-55 itself.
 */
import { getAddress } from 'ethers';
import fc from 'fast-check';
import { toEip55Address } from '@/services/evm/address';

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_CHARS = '0123456789abcdef'.split('');

/** Printable ASCII (space … '~') that is NOT a hex digit. */
const NON_HEX_CHARS = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) =>
  String.fromCharCode(0x20 + i),
).filter((char) => !/[0-9a-fA-F]/.test(char));

/** 20 arbitrary bytes → canonical lowercase 0x-prefixed hex address. */
const lowercaseAddressArb = fc
  .uint8Array({ minLength: 20, maxLength: 20 })
  .map((bytes) => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`);

/** Same address bytes plus a per-character upper/lower casing mask. */
const randomCasingArb = fc
  .tuple(lowercaseAddressArb, fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }))
  .map(([address, mask]) => {
    const body = address
      .slice(2)
      .split('')
      .map((char, i) => (mask[i] ? char.toUpperCase() : char))
      .join('');
    return { lower: address, cased: `0x${body}` };
  });

/** Official test vectors from EIP-55. */
const EIP55_VECTORS = [
  // All caps
  '0x52908400098527886E0F7030069857D2E4169EE7',
  '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
  // All lower
  '0xde709f2102306220921060314715629080e2fb77',
  '0x27b1fdb04752bbc536007a920d24acb045561c26',
  // Normal (mixed)
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
  '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
];

describe('toEip55Address properties', () => {
  it('is idempotent: checksumming a checksummed address is a no-op', () => {
    fc.assert(
      fc.property(lowercaseAddressArb, (address) => {
        const once = toEip55Address(address);
        expect(toEip55Address(once)).toBe(once);
      }),
    );
  });

  it('normalizes lowercase, UPPERCASE and random mixed-case inputs to the same checksum', () => {
    fc.assert(
      fc.property(randomCasingArb, ({ lower, cased }) => {
        const expected = toEip55Address(lower);
        expect(toEip55Address(`0x${lower.slice(2).toUpperCase()}`)).toBe(expected);
        expect(toEip55Address(cased)).toBe(expected);
      }),
    );
  });

  it('preserves the hex digits and produces the canonical 0x + 40 hex shape', () => {
    fc.assert(
      fc.property(lowercaseAddressArb, (address) => {
        const checksummed = toEip55Address(address);
        expect(checksummed).toMatch(EVM_ADDRESS_RE);
        expect(checksummed.toLowerCase()).toBe(address);
        expect(checksummed.startsWith('0x')).toBe(true);
      }),
    );
  });

  it('agrees with ethers getAddress on arbitrary addresses (independent EIP-55 oracle)', () => {
    fc.assert(
      fc.property(lowercaseAddressArb, (address) => {
        expect(toEip55Address(address)).toBe(getAddress(address));
      }),
    );
  });

  describe('rejection of malformed inputs', () => {
    it('rejects hex bodies of any length other than 40', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.constantFrom(...HEX_CHARS), { maxLength: 80 })
            .filter((chars) => chars.length !== 40),
          (chars) => {
            expect(() => toEip55Address(`0x${chars.join('')}`)).toThrow('Invalid EVM address');
          },
        ),
      );
    });

    it('rejects addresses without the 0x prefix', () => {
      fc.assert(
        fc.property(lowercaseAddressArb, (address) => {
          expect(() => toEip55Address(address.slice(2))).toThrow('Invalid EVM address');
          expect(() => toEip55Address(`0X${address.slice(2)}`)).toThrow('Invalid EVM address');
        }),
      );
    });

    it('rejects addresses with a non-hex character injected anywhere in the body', () => {
      fc.assert(
        fc.property(
          lowercaseAddressArb,
          fc.integer({ min: 0, max: 39 }),
          fc.constantFrom(...NON_HEX_CHARS),
          (address, position, badChar) => {
            const body = address.slice(2);
            const corrupted = `0x${body.slice(0, position)}${badChar}${body.slice(position + 1)}`;
            expect(() => toEip55Address(corrupted)).toThrow('Invalid EVM address');
          },
        ),
      );
    });

    it('rejects arbitrary fuzzed strings that do not match the address shape', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 60 }).filter((s) => !EVM_ADDRESS_RE.test(s)),
          (notAnAddress) => {
            expect(() => toEip55Address(notAnAddress)).toThrow('Invalid EVM address');
          },
        ),
      );
    });
  });

  describe('official EIP-55 test vectors', () => {
    it.each(EIP55_VECTORS)('checksums %s correctly from its lowercase form', (vector) => {
      expect(toEip55Address(vector.toLowerCase())).toBe(vector);
    });

    it.each(EIP55_VECTORS)('leaves the already-checksummed vector %s unchanged', (vector) => {
      expect(toEip55Address(vector)).toBe(vector);
    });

    it.each(EIP55_VECTORS)('checksums %s correctly from its UPPERCASE form', (vector) => {
      expect(toEip55Address(`0x${vector.slice(2).toUpperCase()}`)).toBe(vector);
    });
  });
});
