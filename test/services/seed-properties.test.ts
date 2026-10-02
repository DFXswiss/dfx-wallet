/**
 * Property-based + vector-based tests for the BIP-39 seed service.
 *
 * Properties (fast-check):
 * - every generated 12/24-word phrase round-trips through validateSeedPhrase
 * - seedToWords(wordsToSeed(words)) === words, including under arbitrary
 *   whitespace padding (spaces / tabs / newlines / carriage returns)
 *
 * Vectors: official BIP-39 test vectors (Trezor reference set, English
 * wordlist) pin the wordlist + checksum algorithm via bip39 directly, and
 * validateSeedPhrase must accept every official mnemonic and reject
 * mutations (swap, drop, checksum-breaking last word, 13/23 word counts,
 * non-wordlist words, case changes).
 */
import { entropyToMnemonic, wordlists } from 'bip39';
import fc from 'fast-check';
import {
  generateSeedPhrase,
  seedToWords,
  validateSeedPhrase,
  wordsToSeed,
} from '@/services/wallet/seed';

const ENGLISH_WORDLIST = wordlists.english ?? [];
if (ENGLISH_WORDLIST.length !== 2048) {
  throw new Error('bip39 English wordlist must contain exactly 2048 words');
}
const ENGLISH_WORDSET = new Set(ENGLISH_WORDLIST);

/** Official BIP-39 test vectors (Trezor reference set), 12- and 24-word only. */
const BIP39_VECTORS: { entropy: string; mnemonic: string }[] = [
  {
    entropy: '00000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic: 'legal winner thank year wave sausage worth useful legal winner thank yellow',
  },
  {
    entropy: '80808080808080808080808080808080',
    mnemonic: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffff',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
  },
  {
    entropy: '0000000000000000000000000000000000000000000000000000000000000000',
    mnemonic:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
  },
  {
    entropy: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    mnemonic:
      'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title',
  },
  {
    entropy: '8080808080808080808080808080808080808080808080808080808080808080',
    mnemonic:
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless',
  },
  {
    entropy: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    mnemonic:
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
  },
  {
    entropy: '9e885d952ad362caeb4efe34a8e91bd2',
    mnemonic: 'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic',
  },
  {
    entropy: '77c2b00716cec7213839159e404db50d',
    mnemonic: 'jelly better achieve collect unaware mountain thought cargo oxygen act hood bridge',
  },
  {
    entropy: '0460ef47585604c5660618db2e6a7e7f',
    mnemonic: 'afford alter spike radar gate glance object seek swamp infant panel yellow',
  },
  {
    entropy: 'eaebabb2383351fd31d703840b32e9e2',
    mnemonic: 'turtle front uncle idea crush write shrug there lottery flower risk shell',
  },
  {
    entropy: '18ab19a9f54a9274f03e5209a2ac8a91',
    mnemonic: 'board flee heavy tunnel powder denial science ski answer betray cargo cat',
  },
];

const vectorMnemonicArb = fc.constantFrom(...BIP39_VECTORS.map((v) => v.mnemonic));

/** All printable, non-whitespace ASCII characters ('!' … '~'). */
const PRINTABLE_NON_WHITESPACE = Array.from({ length: 0x7e - 0x21 + 1 }, (_, i) =>
  String.fromCharCode(0x21 + i),
);

/** Printable, non-whitespace ASCII tokens — survive a `\s+` split untouched. */
const tokenArb = fc.string({
  unit: fc.constantFrom(...PRINTABLE_NON_WHITESPACE),
  minLength: 1,
  maxLength: 12,
});

const whitespaceArb = fc.string({
  unit: fc.constantFrom(' ', '\t', '\n', '\r'),
  minLength: 1,
  maxLength: 4,
});

const optionalWhitespaceArb = fc.string({
  unit: fc.constantFrom(' ', '\t', '\n', '\r'),
  maxLength: 4,
});

describe('seed service properties', () => {
  describe('generateSeedPhrase round-trip', () => {
    it('every generated 12/24-word phrase validates', () => {
      fc.assert(
        fc.property(fc.constantFrom(12 as const, 24 as const), (wordCount) => {
          const words = generateSeedPhrase(wordCount);
          expect(words).toHaveLength(wordCount);
          expect(validateSeedPhrase(words)).toBe(true);
        }),
      );
    });

    it('every generated word is a lowercase English BIP-39 wordlist word', () => {
      fc.assert(
        fc.property(fc.constantFrom(12 as const, 24 as const), (wordCount) => {
          for (const word of generateSeedPhrase(wordCount)) {
            expect(ENGLISH_WORDSET.has(word)).toBe(true);
            expect(word).toBe(word.toLowerCase());
          }
        }),
      );
    });

    it('generated phrases survive the wordsToSeed → seedToWords round-trip and still validate', () => {
      fc.assert(
        fc.property(fc.constantFrom(12 as const, 24 as const), (wordCount) => {
          const words = generateSeedPhrase(wordCount);
          const roundTripped = seedToWords(wordsToSeed(words));
          expect(roundTripped).toEqual(words);
          expect(validateSeedPhrase(roundTripped)).toBe(true);
        }),
      );
    });
  });

  describe('seedToWords / wordsToSeed round-trip', () => {
    it('seedToWords(wordsToSeed(words)) === words for arbitrary non-whitespace tokens', () => {
      fc.assert(
        fc.property(fc.array(tokenArb, { minLength: 1, maxLength: 30 }), (words) => {
          expect(seedToWords(wordsToSeed(words))).toEqual(words);
        }),
      );
    });

    it('recovers the exact word array under arbitrary whitespace padding and separators', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(tokenArb, whitespaceArb), { minLength: 1, maxLength: 30 }),
          optionalWhitespaceArb,
          (wordsWithSeparators, leadingPad) => {
            const words = wordsWithSeparators.map(([word]) => word);
            const seed = leadingPad + wordsWithSeparators.map(([word, ws]) => word + ws).join('');
            expect(seedToWords(seed)).toEqual(words);
          },
        ),
      );
    });

    it('seedToWords of generated mnemonics with messy padding still validates', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(12 as const, 24 as const),
          fc.array(whitespaceArb, { minLength: 25, maxLength: 25 }),
          optionalWhitespaceArb,
          (wordCount, separators, leadingPad) => {
            const words = generateSeedPhrase(wordCount);
            const messy = leadingPad + words.map((word, i) => word + separators[i]).join('');
            expect(seedToWords(messy)).toEqual(words);
            expect(validateSeedPhrase(seedToWords(messy))).toBe(true);
          },
        ),
      );
    });

    it('empty / whitespace-only seeds produce an empty (and invalid) word array', () => {
      fc.assert(
        fc.property(optionalWhitespaceArb, (ws) => {
          expect(seedToWords(ws)).toEqual([]);
          expect(validateSeedPhrase(seedToWords(ws))).toBe(false);
        }),
      );
    });
  });

  describe('official BIP-39 test vectors (Trezor, English wordlist)', () => {
    it.each(BIP39_VECTORS)('entropy $entropy → known mnemonic via bip39', ({ entropy, mnemonic }) => {
      expect(entropyToMnemonic(entropy)).toBe(mnemonic);
    });

    it.each(BIP39_VECTORS)('validateSeedPhrase accepts vector mnemonic for $entropy', ({ mnemonic }) => {
      expect(validateSeedPhrase(seedToWords(mnemonic))).toBe(true);
    });

    it('rejects any vector with a single word dropped (11/23 words)', () => {
      fc.assert(
        fc.property(vectorMnemonicArb, fc.nat(), (mnemonic, seedIndex) => {
          const words = seedToWords(mnemonic);
          const dropIndex = seedIndex % words.length;
          const dropped = words.filter((_, i) => i !== dropIndex);
          expect(validateSeedPhrase(dropped)).toBe(false);
        }),
      );
    });

    it('rejects 13/25-word phrases built by appending a wordlist word to a valid vector', () => {
      fc.assert(
        fc.property(vectorMnemonicArb, fc.constantFrom(...ENGLISH_WORDLIST), (mnemonic, extra) => {
          expect(validateSeedPhrase([...seedToWords(mnemonic), extra])).toBe(false);
        }),
      );
    });

    it('rejects any vector with a word replaced by a non-wordlist token', () => {
      fc.assert(
        fc.property(vectorMnemonicArb, fc.nat(), (mnemonic, seedIndex) => {
          const words = [...seedToWords(mnemonic)];
          const replaceIndex = seedIndex % words.length;
          words[replaceIndex] = 'notabip39word';
          expect(validateSeedPhrase(words)).toBe(false);
        }),
      );
    });

    it('rejects any vector with a word capitalized (wordlist lookup is case-sensitive)', () => {
      fc.assert(
        fc.property(vectorMnemonicArb, fc.nat(), (mnemonic, seedIndex) => {
          const words = [...seedToWords(mnemonic)];
          const caseIndex = seedIndex % words.length;
          const original = words[caseIndex] ?? '';
          words[caseIndex] = original.charAt(0).toUpperCase() + original.slice(1);
          expect(validateSeedPhrase(words)).toBe(false);
        }),
      );
    });

    it('rejects checksum-breaking last-word changes on known vectors', () => {
      // ff…ff entropy checksums to "wrong"; replacing it with "zoo" breaks the checksum.
      expect(validateSeedPhrase(Array.from({ length: 12 }, () => 'zoo'))).toBe(false);
      expect(validateSeedPhrase(Array.from({ length: 24 }, () => 'zoo'))).toBe(false);
      // 00…00 entropy checksums to "about"; replacing it with "abandon" breaks the checksum.
      expect(validateSeedPhrase(Array.from({ length: 12 }, () => 'abandon'))).toBe(false);
      expect(validateSeedPhrase(Array.from({ length: 24 }, () => 'abandon'))).toBe(false);
    });

    it('rejects a known word-swap mutation of an official vector', () => {
      // "ozone drill …" is valid; swapping the first two words breaks the checksum.
      expect(
        validateSeedPhrase(
          seedToWords('drill ozone grab fiber curtain grace pudding thank cruise elder eight picnic'),
        ),
      ).toBe(false);
    });

    it('rejects wrong word counts derived from any vector prefix', () => {
      fc.assert(
        fc.property(vectorMnemonicArb, fc.integer({ min: 1, max: 23 }), (mnemonic, count) => {
          fc.pre(count !== 12);
          const words = seedToWords(mnemonic).slice(0, count);
          fc.pre(words.length === count); // 12-word vectors cannot yield >12-word prefixes
          expect(validateSeedPhrase(words)).toBe(false);
        }),
      );
    });
  });
});
