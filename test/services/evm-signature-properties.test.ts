/**
 * Property-based + vector-based tests for personal_sign recovery
 * (src/services/evm/signature.ts).
 *
 * Properties (fast-check):
 * - sign → recover round-trips to the signer's EIP-55 address for arbitrary
 *   private keys and arbitrary unicode messages
 * - the recovered address is always EIP-55 normalized
 * - v-normalization: 65-byte signatures with v ∈ {27, 28} and the equivalent
 *   yParity form v ∈ {0, 1} recover the same address
 * - EIP-2098 64-byte compact signatures recover the same address
 * - structural invariants: r/s are 32 bytes, v ∈ {27, 28}, parse/serialize
 *   round-trips
 * - malformed input never throws uncontrolled: every failure is an Error
 *   instance, every success is a checksummed address (fuzzed)
 */
import { Signature, Wallet } from 'ethers';
import fc from 'fast-check';
import { toEip55Address } from '@/services/evm/address';
import {
  EVM_AUTH_ADDRESS_PROBE_MESSAGE,
  recoverPersonalSignAddress,
} from '@/services/evm/signature';

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SECP256K1_ORDER = BigInt(
  '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
);

/** Arbitrary valid secp256k1 private key (0 < k < curve order). */
const privateKeyArb = fc
  .uint8Array({ minLength: 32, maxLength: 32 })
  .map((bytes) => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`)
  .filter((hex) => {
    const k = BigInt(hex);
    return k > 0n && k < SECP256K1_ORDER;
  });

const messageArb = fc.string({ maxLength: 64 });

type RecoveryOutcome = { address: string } | { error: unknown };

function tryRecover(message: string, signature: string): RecoveryOutcome {
  try {
    return { address: recoverPersonalSignAddress(message, signature) };
  } catch (error) {
    return { error };
  }
}

describe('recoverPersonalSignAddress properties', () => {
  it('round-trips: signing an arbitrary message with an arbitrary key recovers the signer', async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyArb, messageArb, async (privateKey, message) => {
        const wallet = new Wallet(privateKey);
        const signature = await wallet.signMessage(message);
        expect(recoverPersonalSignAddress(message, signature)).toBe(wallet.address);
      }),
    );
  }, 30000);

  it('always returns an EIP-55 normalized address on success', async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyArb, messageArb, async (privateKey, message) => {
        const wallet = new Wallet(privateKey);
        const signature = await wallet.signMessage(message);
        const recovered = recoverPersonalSignAddress(message, signature);
        expect(recovered).toMatch(EVM_ADDRESS_RE);
        expect(toEip55Address(recovered)).toBe(recovered);
      }),
    );
  }, 30000);

  it('normalizes v: 27/28 and the yParity 0/1 form recover the same address', async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyArb, messageArb, async (privateKey, message) => {
        const wallet = new Wallet(privateKey);
        const signature = await wallet.signMessage(message);

        const v = Number.parseInt(signature.slice(-2), 16);
        expect([27, 28]).toContain(v);

        const yParityForm = signature.slice(0, -2) + (v - 27).toString(16).padStart(2, '0');
        expect(recoverPersonalSignAddress(message, yParityForm)).toBe(wallet.address);
      }),
    );
  }, 30000);

  it('accepts EIP-2098 64-byte compact signatures and recovers the same address', async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyArb, messageArb, async (privateKey, message) => {
        const wallet = new Wallet(privateKey);
        const signature = await wallet.signMessage(message);

        const compact = Signature.from(signature).compactSerialized;
        expect(compact).toHaveLength(2 + 64 * 2);
        expect(recoverPersonalSignAddress(message, compact)).toBe(wallet.address);
      }),
    );
  }, 30000);

  it('produced signatures hold structural invariants: 32-byte r/s, v ∈ {27,28}, parse round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(privateKeyArb, messageArb, async (privateKey, message) => {
        const wallet = new Wallet(privateKey);
        const signature = await wallet.signMessage(message);
        expect(signature).toMatch(/^0x[0-9a-f]{130}$/);

        const parsed = Signature.from(signature);
        expect(parsed.r).toMatch(/^0x[0-9a-f]{64}$/i);
        expect(parsed.s).toMatch(/^0x[0-9a-f]{64}$/i);
        expect([27, 28]).toContain(parsed.v);
        expect([0, 1]).toContain(parsed.yParity);
        expect(parsed.v - 27).toBe(parsed.yParity);
        expect(parsed.serialized.toLowerCase()).toBe(signature.toLowerCase());
      }),
    );
  }, 30000);

  it('a signature does not verify against a different message', async () => {
    await fc.assert(
      fc.asyncProperty(
        privateKeyArb,
        messageArb,
        messageArb,
        async (privateKey, message, otherMessage) => {
          fc.pre(message !== otherMessage);
          const wallet = new Wallet(privateKey);
          const signature = await wallet.signMessage(message);
          const outcome = tryRecover(otherMessage, signature);
          if ('address' in outcome) {
            expect(outcome.address).not.toBe(wallet.address);
          } else {
            expect(outcome.error).toBeInstanceOf(Error);
          }
        },
      ),
    );
  }, 30000);

  describe('malformed input never throws uncontrolled', () => {
    it('arbitrary fuzzed signature strings either throw an Error or yield a checksummed address', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 160 }), messageArb, (signature, message) => {
          const outcome = tryRecover(message, signature);
          if ('error' in outcome) {
            expect(outcome.error).toBeInstanceOf(Error);
          } else {
            expect(outcome.address).toMatch(EVM_ADDRESS_RE);
            expect(toEip55Address(outcome.address)).toBe(outcome.address);
          }
        }),
      );
    });

    it('arbitrary 65-byte signatures either throw an Error or recover a checksummed address', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 65, maxLength: 65 }),
          messageArb,
          (bytes, message) => {
            const signature = `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
            const outcome = tryRecover(message, signature);
            if ('error' in outcome) {
              expect(outcome.error).toBeInstanceOf(Error);
            } else {
              expect(outcome.address).toMatch(EVM_ADDRESS_RE);
              expect(toEip55Address(outcome.address)).toBe(outcome.address);
            }
          },
        ),
      );
    });

    it('hex blobs of wrong byte lengths (not 64/65) always throw an Error', () => {
      fc.assert(
        fc.property(
          fc
            .uint8Array({ maxLength: 100 })
            .filter((bytes) => bytes.length !== 64 && bytes.length !== 65),
          messageArb,
          (bytes, message) => {
            const signature = `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
            const outcome = tryRecover(message, signature);
            expect('error' in outcome).toBe(true);
            if ('error' in outcome) expect(outcome.error).toBeInstanceOf(Error);
          },
        ),
      );
    });
  });

  describe('deterministic vectors', () => {
    // RFC 6979 makes signing deterministic, so this pins key → signature → address.
    const privateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const address = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c';
    const probeSignature =
      '0xd11caca9a2febccda6e82fe83b73e0178f2deb5995710a3792cdce5e2872b8f01007a9883ae443c1f284dc55756d30203bc20925d13f9b856754988935f819361b';

    it('recovers the known address from the pinned probe-message signature', () => {
      expect(recoverPersonalSignAddress(EVM_AUTH_ADDRESS_PROBE_MESSAGE, probeSignature)).toBe(
        address,
      );
    });

    it('signing the probe message with the pinned key reproduces the pinned signature', async () => {
      const wallet = new Wallet(privateKey);
      expect(wallet.address).toBe(address);
      await expect(wallet.signMessage(EVM_AUTH_ADDRESS_PROBE_MESSAGE)).resolves.toBe(
        probeSignature,
      );
    });
  });
});
