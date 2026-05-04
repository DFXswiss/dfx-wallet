import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { entropyToMnemonic } from 'bip39';

const HKDF_SALT = new TextEncoder().encode('dfx-wallet-seed-derivation');
const HKDF_INFO = new TextEncoder().encode('mnemonic-v1');

/**
 * Derive a 12-word BIP-39 mnemonic from a passkey PRF output.
 *
 * Flow: PRF output (32 bytes) → HKDF-SHA256 (16 bytes = 128 bits) → BIP-39 mnemonic (12 words)
 */
export function deriveMnemonicFromPrf(prfOutput: Uint8Array): string {
  if (prfOutput.length !== 32) {
    throw new Error(`Expected 32-byte PRF output, got ${prfOutput.length}`);
  }

  const derived = hkdf(sha256, prfOutput, HKDF_SALT, HKDF_INFO, 16);
  const entropy = Buffer.from(derived);
  return entropyToMnemonic(entropy);
}
