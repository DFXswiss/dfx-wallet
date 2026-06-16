// Copyright (c) 2026 DFX AG. Licensed under the MIT License.
//
// Cloister shielded-note key hierarchy, derived DETERMINISTICALLY from the wallet's BIP-39
// mnemonic. This replaces the former per-install RANDOM key (which lived only in this device's
// SecureStore): a random key meant a lost/reinstalled device = permanently unspendable shielded
// notes, even though the wallet's normal balance restored fine from the seed — a silent
// loss-of-funds trap. Deriving from the same seed the wallet already backs up makes the private
// balance recoverable: restore the 12/24 words → re-derive the same keys → re-scan → notes back.
//
// Hierarchy (HKDF-SHA256 over the BIP-39 seed, domain-separated):
//   spendKey — note owner / spend authority (this is the circuit's privKey; pubKey = H(spendKey))
//   viewKey  — note decryption / selective disclosure (read-only; for the compliance/auditor flow
//              and watch-only scanning). Separable from spendKey: handing out the view key never
//              grants spend ability. (The on-chain note-encryption wiring lands with the scanning
//              feature; the key is derived now so the hierarchy is fixed and recoverable.)
//
// NOTE on the circuit: this is a WALLET/SDK-side derivation only — the circuit takes privKey as a
// field input and is indifferent to its origin, so nothing here touches the circuit, keys or
// verifier. (Full in-circuit spend/view/nullifier-key separation is a separate circuit change.)

import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { mnemonicToSeedSync } from 'bip39';

const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ASCII → bytes (avoids a TextEncoder/Buffer dependency for these constant tags).
const ascii = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));
const SALT = ascii('cloister-shielded-pool/v1');
const INFO_SPEND = ascii('cloister/v1/spend');
const INFO_VIEW = ascii('cloister/v1/view');

// HKDF-Expand to 512 bits, then reduce mod FIELD. 512 ≫ 254 bits ⇒ the modulo bias is
// cryptographically negligible (≈ 2^-258), so the key is uniform over the field.
function deriveField(seed: Uint8Array, info: Uint8Array): string {
  const okm = hkdf(sha256, seed, SALT, info, 64);
  let acc = 0n;
  for (const b of okm) acc = (acc << 8n) | BigInt(b);
  return (acc % FIELD).toString();
}

export interface CloisterKeys {
  /** Note owner / spend authority — the circuit's private key. Keep secret. */
  spendKey: string;
  /** Read-only view/disclosure key — safe to export for auditor/watch-only use. */
  viewKey: string;
}

/**
 * Deterministically derive the Cloister key hierarchy from the wallet mnemonic. Pure +
 * side-effect-free → unit-testable; the same mnemonic always yields the same keys (recoverability).
 */
export function deriveCloisterKeys(mnemonic: string): CloisterKeys {
  const m = (mnemonic ?? '').trim();
  if (m.split(/\s+/).filter(Boolean).length < 12) {
    throw new Error(
      'cloister: wallet mnemonic unavailable — refusing to derive non-recoverable note keys',
    );
  }
  const seed = mnemonicToSeedSync(m); // BIP-39 seed (PBKDF2) — the canonical root
  return {
    spendKey: deriveField(seed, INFO_SPEND),
    viewKey: deriveField(seed, INFO_VIEW),
  };
}

/** Convenience: the note-owner spend key (the value passed to the prover as ownerPriv). */
export function deriveOwnerSpendKey(mnemonic: string): string {
  return deriveCloisterKeys(mnemonic).spendKey;
}
