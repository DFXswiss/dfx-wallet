import { validateMnemonic, mnemonicToEntropy } from 'bip39';
import {
  deriveMnemonicFromPrf,
  DERIVATION_VERSION,
} from '../../src/features/passkey/services/key-derivation';

// A fixed, non-random 32-byte PRF output. Using a deterministic pattern (not
// Crypto.getRandomBytes) so the golden vector below is reproducible across runs.
const PRF_32 = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));

describe('deriveMnemonicFromPrf', () => {
  it('derives a valid 12-word BIP-39 mnemonic', () => {
    const mnemonic = deriveMnemonicFromPrf(PRF_32);
    expect(mnemonic.split(' ')).toHaveLength(12);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('is deterministic: same PRF output yields the same mnemonic', () => {
    expect(deriveMnemonicFromPrf(PRF_32)).toBe(deriveMnemonicFromPrf(PRF_32));
  });

  it('derives 128 bits of entropy (16 bytes) from the 32-byte PRF output', () => {
    const entropyHex = mnemonicToEntropy(deriveMnemonicFromPrf(PRF_32));
    expect(entropyHex).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  it('produces different mnemonics for different PRF outputs', () => {
    const other = PRF_32.map((b, i) => (i === 0 ? b ^ 0xff : b)); // flip one byte
    expect(deriveMnemonicFromPrf(other)).not.toBe(deriveMnemonicFromPrf(PRF_32));
  });

  // GOLDEN VECTOR — this is the most important test in this file.
  // It pins the exact PRF -> mnemonic mapping for version 1. If any derivation
  // parameter (salt, info, hash, output length, BIP-39 wordlist) ever changes,
  // this fails loudly. A silent change here would re-derive a DIFFERENT seed
  // for every existing passkey wallet => permanent loss of funds.
  it('matches the version-1 golden vector (locks the derivation against drift)', () => {
    expect(DERIVATION_VERSION).toBe(1);
    expect(deriveMnemonicFromPrf(PRF_32, 1)).toBe(
      'join proof grab rough pen giant unique shiver settle enter extra enough',
    );
  });

  describe('input validation', () => {
    it.each([0, 16, 31, 33, 64])('rejects a PRF output of %i bytes', (len) => {
      expect(() => deriveMnemonicFromPrf(new Uint8Array(len))).toThrow(/32-byte PRF output/);
    });

    it('rejects an unknown derivation version', () => {
      expect(() => deriveMnemonicFromPrf(PRF_32, 999)).toThrow(/Unknown derivation version/);
    });
  });
});
