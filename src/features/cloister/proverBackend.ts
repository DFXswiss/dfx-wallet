// Copyright (c) 2026 DFX AG. All rights reserved. Proprietary and confidential.
//
// Wires the Cloister SDK's pluggable crypto backend to the on-device native prover
// (modules/cloister-prover). After calling wireCloisterNativeBackend() once, the SDK's
// hashing (Poseidon2) and proving (Groth16) run fully on-device — the private witness
// never leaves the phone, so payments work on any network (VPN, cellular, offline RPC).
//
// The SDK is consumed as a dependency: add `@cloister/sdk` (the
// cloister-protocol/packages/sdk package) to the wallet's package.json, e.g. via a
// file: link or a published version.

import { setHashBackend, setProveBackend } from '@cloister/sdk';
import * as CloisterProver from 'cloister-prover';

let wired = false;

/**
 * Idempotently load the on-device prover keys and point the SDK at the native
 * module. Call once before the first Cloister payment (e.g. on the pay screen mount).
 */
export async function wireCloisterNativeBackend(): Promise<void> {
  if (wired) return;
  if (!CloisterProver.isCloisterNativeAvailable()) {
    throw new Error('Cloister native prover unavailable — run a dev/release build (not Expo Go).');
  }
  await CloisterProver.initProver();

  setHashBackend(async (items: bigint[]) => CloisterProver.hash(items));
  setProveBackend(async (witnessInput: unknown) => CloisterProver.prove(witnessInput));

  wired = true;
}

export function isCloisterNativeReady(): boolean {
  return CloisterProver.isReady();
}
