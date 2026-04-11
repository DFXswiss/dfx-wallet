import * as Crypto from 'expo-crypto';

const SALT = 'dfx-wallet-pin-v1';
const ITERATIONS = 10000;

/**
 * Hash a PIN using PBKDF2-like approach via SHA-256.
 * Iterates SHA-256 with a salt for key stretching.
 */
export async function hashPin(pin: string): Promise<string> {
  let hash = `${SALT}:${pin}`;
  for (let i = 0; i < ITERATIONS; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
}

/**
 * Verify a PIN against a stored hash.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}
