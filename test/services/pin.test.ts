import { hashPin, verifyPin } from '../../src/services/pin';

describe('hashPin', () => {
  it('returns a deterministic hash for the same input', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).toBe(b);
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
    await expect(hashPin('')).resolves.toEqual(expect.any(String));
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
});
