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

    it('should return non-empty words', () => {
      const words = generateSeedPhrase(24);
      words.forEach((word) => {
        expect(word.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateSeedPhrase', () => {
    it('should accept 12 words', () => {
      const words = Array.from({ length: 12 }, (_, i) => `word${i}`);
      expect(validateSeedPhrase(words)).toBe(true);
    });

    it('should accept 24 words', () => {
      const words = Array.from({ length: 24 }, (_, i) => `word${i}`);
      expect(validateSeedPhrase(words)).toBe(true);
    });

    it('should reject 11 words', () => {
      const words = Array.from({ length: 11 }, (_, i) => `word${i}`);
      expect(validateSeedPhrase(words)).toBe(false);
    });

    it('should reject empty words', () => {
      const words = Array.from({ length: 12 }, () => '');
      expect(validateSeedPhrase(words)).toBe(false);
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
