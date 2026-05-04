import { generateMnemonic, validateMnemonic } from 'bip39';

/**
 * Generate a new BIP-39 seed phrase using real cryptographic randomness.
 * @param wordCount 12 or 24 words
 */
export function generateSeedPhrase(wordCount: 12 | 24 = 12): string[] {
  const strength = wordCount === 12 ? 128 : 256;
  const mnemonic = generateMnemonic(strength);
  return mnemonic.split(' ');
}

/**
 * Validate a seed phrase against the BIP-39 wordlist.
 * @returns true if the seed phrase is valid BIP-39
 */
export function validateSeedPhrase(words: string[]): boolean {
  if (words.length !== 12 && words.length !== 24) return false;
  return validateMnemonic(words.join(' '));
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
