import { deriveCloisterKeys, deriveOwnerSpendKey } from '@/features/cloister/ownerKey';

// The Cloister note keys are derived deterministically from the wallet's BIP-39 mnemonic so the
// shielded balance is RECOVERABLE from the seed (the former per-install random key was lost on
// reinstall = permanent loss of the private balance). These tests pin that contract:
// determinism (= recoverability), domain separation, field range, and fail-closed on a bad seed.

const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
// A standard BIP-39 test vector mnemonic (NOT a real wallet).
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

describe('cloister key derivation', () => {
  it('is deterministic — the same mnemonic always yields the same keys (recoverability)', () => {
    const a = deriveCloisterKeys(TEST_MNEMONIC);
    const b = deriveCloisterKeys(TEST_MNEMONIC);
    expect(a).toEqual(b);
    // and tolerant of surrounding whitespace (paste artifacts)
    expect(deriveCloisterKeys(`  ${TEST_MNEMONIC}  `)).toEqual(a);
  });

  it('pins golden keys for a known mnemonic (regression guard against derivation drift)', () => {
    const { spendKey, viewKey } = deriveCloisterKeys(TEST_MNEMONIC);
    expect(spendKey).toBe(
      '2019668917662005377060876511495559921596816153681670372207897611829556380290',
    );
    expect(viewKey).toBe(
      '12293793045763169875672056717652422636071107327019990335899601086908729681251',
    );
  });

  it('separates spend and view keys (domain separation)', () => {
    const { spendKey, viewKey } = deriveCloisterKeys(TEST_MNEMONIC);
    expect(spendKey).not.toBe(viewKey);
  });

  it('produces in-field, non-zero keys', () => {
    const { spendKey, viewKey } = deriveCloisterKeys(TEST_MNEMONIC);
    for (const k of [spendKey, viewKey]) {
      const n = BigInt(k);
      expect(n).toBeGreaterThan(0n);
      expect(n).toBeLessThan(FIELD);
    }
  });

  it('derives different keys for different mnemonics', () => {
    expect(deriveCloisterKeys(TEST_MNEMONIC).spendKey).not.toBe(
      deriveCloisterKeys(OTHER_MNEMONIC).spendKey,
    );
  });

  it('deriveOwnerSpendKey matches the hierarchy spend key', () => {
    expect(deriveOwnerSpendKey(TEST_MNEMONIC)).toBe(deriveCloisterKeys(TEST_MNEMONIC).spendKey);
  });

  it('fails closed on a missing/too-short mnemonic (never a non-recoverable key)', () => {
    expect(() => deriveCloisterKeys('')).toThrow();
    expect(() => deriveCloisterKeys('too short phrase')).toThrow();
    // @ts-expect-error — guarding the null path
    expect(() => deriveCloisterKeys(undefined)).toThrow();
  });
});
