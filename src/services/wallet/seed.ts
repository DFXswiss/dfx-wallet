/**
 * Seed phrase utilities.
 *
 * In production this will delegate to WDK's seed generation.
 * For now, provides the interface that screens depend on.
 */

const WORDLIST_SIZE = 2048;

/**
 * Generate a new BIP-39 seed phrase.
 * @param wordCount 12 or 24 words
 */
export function generateSeedPhrase(wordCount: 12 | 24 = 24): string[] {
  // TODO: Replace with WDK.getRandomSeedPhrase(wordCount)
  // This is a placeholder — DO NOT use in production
  const placeholder = Array.from({ length: wordCount }, (_, i) => `word${i + 1}`);
  return placeholder;
}

/**
 * Validate a seed phrase.
 * @returns true if the seed phrase is valid BIP-39
 */
export function validateSeedPhrase(words: string[]): boolean {
  // TODO: Replace with WDK seed validation
  if (words.length !== 12 && words.length !== 24) return false;
  return words.every((w) => w.trim().length > 0);
}

/** Convert a space-separated seed string to word array */
export function seedToWords(seed: string): string[] {
  return seed
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Convert word array to space-separated seed string */
export function wordsToSeed(words: string[]): string {
  return words.join(' ');
}
