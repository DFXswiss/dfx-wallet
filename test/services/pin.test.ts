jest.mock('@noble/hashes/argon2', () => ({
  argon2idAsync: jest.fn(async (password: string, salt: Uint8Array, opts: { dkLen: number }) => {
    const bytes = new Uint8Array(opts.dkLen);
    const input = `${password}:${Array.from(salt).join(',')}`;
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = input.charCodeAt(i % input.length) ^ i;
    }
    return bytes;
  }),
}));

import { hashPin, needsPinRehash, verifyPin } from '../../src/services/pin';

const legacyHashPin = async (pin: string): Promise<string> => {
  const Crypto = await import('expo-crypto');
  let hash = `dfx-wallet-pin-v1:${pin}`;
  for (let i = 0; i < 10000; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
};

describe('hashPin', () => {
  it('uses a random salt for the same input', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
  });

  it('returns different hashes for different PINs', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('5678');
    expect(a).not.toBe(b);
  });

  it('returns different hashes for similar PINs (no truncation collision)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('12345');
    expect(a).not.toBe(b);
  });

  it('handles empty input without throwing', async () => {
    await expect(hashPin('')).resolves.toMatch(/^pin\$argon2id\$/);
  });

  it('handles unicode / non-ASCII input', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234✨');
    expect(a).not.toBe(b);
  });
});

describe('verifyPin', () => {
  it('returns true when the PIN matches the stored hash', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('1234', hash)).toBe(true);
  });

  it('returns false for a wrong PIN', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('0000', hash)).toBe(false);
  });

  it('returns false for an empty PIN against a real hash', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('', hash)).toBe(false);
  });

  it('returns false against a malformed stored hash', async () => {
    expect(await verifyPin('1234', 'not-a-real-hash')).toBe(false);
  });

  it('accepts legacy hashes so existing users can migrate', async () => {
    const legacyHash = await legacyHashPin('1234');
    expect(await verifyPin('1234', legacyHash)).toBe(true);
    expect(needsPinRehash(legacyHash)).toBe(true);
  });

  it('does not mark current Argon2id hashes for rehash', async () => {
    const hash = await hashPin('1234');
    expect(needsPinRehash(hash)).toBe(false);
  });
});
