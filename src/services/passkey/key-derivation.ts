import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { entropyToMnemonic } from 'bip39';

/** Current derivation version — increment when changing parameters. */
export const DERIVATION_VERSION = 1;

type DerivationParams = {
  salt: Uint8Array;
  info: Uint8Array;
};

const PARAMS_BY_VERSION: Record<number, DerivationParams> = {
  1: {
    salt: new TextEncoder().encode('dfx-wallet-seed-derivation'),
    info: new TextEncoder().encode('mnemonic-v1'),
  },
};

/**
 * Derive a 12-word BIP-39 mnemonic from a passkey PRF output.
 *
 * Flow: PRF output (32 bytes) → HKDF-SHA256 (16 bytes = 128 bits) → BIP-39 mnemonic (12 words)
 *
 * @param version - Derivation version (defaults to current). Stored in SecureStore
 *   so existing wallets keep working if parameters change in future versions.
 */
export function deriveMnemonicFromPrf(prfOutput: Uint8Array, version = DERIVATION_VERSION): string {
  if (prfOutput.length !== 32) {
    throw new Error(`Expected 32-byte PRF output, got ${prfOutput.length}`);
  }

  const params = PARAMS_BY_VERSION[version];
  if (!params) {
    throw new Error(`Unknown derivation version: ${version}`);
  }

  const derived = hkdf(sha256, prfOutput, params.salt, params.info, 16);
  const entropy = Buffer.from(derived);
  return entropyToMnemonic(entropy);
}
