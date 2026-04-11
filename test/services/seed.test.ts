import {
  generateSeedPhrase,
  validateSeedPhrase,
  seedToWords,
  wordsToSeed,
} from '../../src/services/wallet/seed';

describe('Seed utilities', () => {
  describe('generateSeedPhrase', () => {
    it('should generate 24 words by default', () => {
      const words = generateSeedPhrase();
      expect(words).toHaveLength(24);
    });

    it('should generate 12 words when specified', () => {
      const words = generateSeedPhrase(12);
      expect(words).toHaveLength(12);
    });

    it('should generate valid BIP-39 mnemonics', () => {
      const words = generateSeedPhrase(24);
      expect(validateSeedPhrase(words)).toBe(true);
    });

    it('should generate different seeds each time', () => {
      const seed1 = wordsToSeed(generateSeedPhrase());
      const seed2 = wordsToSeed(generateSeedPhrase());
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('validateSeedPhrase', () => {
    it('should accept valid 12-word mnemonic', () => {
      const words = generateSeedPhrase(12);
      expect(validateSeedPhrase(words)).toBe(true);
    });

    it('should accept valid 24-word mnemonic', () => {
      const words = generateSeedPhrase(24);
      expect(validateSeedPhrase(words)).toBe(true);
    });

    it('should reject invalid word count', () => {
      expect(validateSeedPhrase(['hello', 'world'])).toBe(false);
    });

    it('should reject invalid words', () => {
      const badWords = Array.from({ length: 12 }, () => 'invalidxyz');
      expect(validateSeedPhrase(badWords)).toBe(false);
    });
  });

  describe('seedToWords', () => {
    it('should split by whitespace', () => {
      expect(seedToWords('hello world foo')).toEqual(['hello', 'world', 'foo']);
    });

    it('should handle extra whitespace', () => {
      expect(seedToWords('  hello   world  ')).toEqual(['hello', 'world']);
    });

    it('should return empty array for empty string', () => {
      expect(seedToWords('')).toEqual([]);
    });
  });

  describe('wordsToSeed', () => {
    it('should join with spaces', () => {
      expect(wordsToSeed(['hello', 'world'])).toBe('hello world');
    });
  });
});
