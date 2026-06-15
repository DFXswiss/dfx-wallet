// Copyright (c) 2026 DFX AG. All rights reserved. Proprietary and confidential.
//
// Per-install note-owner (spend) key for Cloister shielded notes. Replaces the former
// hardcoded constant ('12345'), which made every user's notes share one trivially
// guessable owner — a full ownership/privacy break. Here each install generates a random
// field element once and persists it in the device Secure Enclave/Keychain; it never
// leaves the device. (Production target: derive deterministically from the wallet seed so
// it survives a reinstall/restore — tracked with the WDK signer migration.)

import * as SecureStore from 'expo-secure-store';
import { hexlify, randomBytes } from 'ethers';

const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const STORE_KEY = 'cloisterOwnerKey';

let cached: string | null = null;

/** Decimal field element used as the note-owner spend key. Generated once per install. */
export async function getOwnerKey(): Promise<string> {
  if (cached) return cached;
  const existing = await SecureStore.getItemAsync(STORE_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const key = (BigInt(hexlify(randomBytes(32))) % FIELD).toString();
  await SecureStore.setItemAsync(STORE_KEY, key);
  cached = key;
  return key;
}
