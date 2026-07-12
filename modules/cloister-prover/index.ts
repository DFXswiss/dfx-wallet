// Copyright (c) 2026 DFX AG. Licensed under the MIT License.
//
// Native on-device Cloister prover (gnark/Groth16 + Poseidon2). This is the
// production proving backend: the private witness never leaves the device.

import { requireNativeModule } from 'expo-modules-core';

export interface CloisterProveResult {
  proofHex: string;
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  publicSignals: string[]; // length 10, on-chain order
}

export interface CloisterDepositParams {
  amount: string;
  ownerPriv: string;
  root: string;
  pairIndex: number;
  pairPathEls: string[];
  extDataHash: string;
}

interface CloisterProverNative {
  initProver(): Promise<boolean>;
  isReady(): boolean;
  hash(itemsJSON: string): Promise<string>;
  prove(witnessInputJSON: string): Promise<string>;
  proveDeposit(paramsJSON: string): Promise<string>;
  proveDepositFromLeaves(paramsJSON: string): Promise<string>;
}

/** Fallback deposit input: the wallet supplies the pool's existing commitments
 *  (fetched via ethers) and the native prover rebuilds the tree + proves — no
 *  chain access in native code (the wallet broadcasts the tx itself). */
export interface CloisterDepositFromLeavesParams {
  amount: string;
  ownerPriv: string;
  leaves: string[];
  extDataHash: string;
}

// Throws at import time only if the native module is entirely absent (e.g. running
// in an Expo Go client without the dev build). Callers should feature-detect via
// `isCloisterNativeAvailable()`.
let _native: CloisterProverNative | null = null;
function native(): CloisterProverNative {
  if (!_native) _native = requireNativeModule<CloisterProverNative>('CloisterProver');
  return _native;
}

export function isCloisterNativeAvailable(): boolean {
  try {
    native();
    return true;
  } catch {
    return false;
  }
}

/** Load the circuit + keys from the app bundle. Idempotent; safe to call repeatedly. */
export function initProver(): Promise<boolean> {
  return native().initProver();
}

export function isReady(): boolean {
  try {
    return native().isReady();
  } catch {
    return false;
  }
}

/** Poseidon2 over an array of decimal/hex field elements → decimal string. */
export async function hash(items: (string | bigint)[]): Promise<bigint> {
  const out = await native().hash(JSON.stringify(items.map((x) => x.toString())));
  return BigInt(out);
}

/** Groth16 proof for a buildWitness() witness input. */
export async function prove(witnessInput: unknown): Promise<CloisterProveResult> {
  const out = await native().prove(JSON.stringify(witnessInput));
  return JSON.parse(out) as CloisterProveResult;
}

/** Build + prove a deposit (shield) on-device from the relayer's insertion context. */
export async function proveDeposit(params: CloisterDepositParams): Promise<CloisterProveResult> {
  const out = await native().proveDeposit(JSON.stringify(params));
  return JSON.parse(out) as CloisterProveResult;
}

/** Prove a deposit on-device from the pool's existing commitments (fallback when no
 *  relayer-supplied context is available). The wallet broadcasts the tx itself. */
export async function proveDepositFromLeaves(
  params: CloisterDepositFromLeavesParams,
): Promise<CloisterProveResult> {
  const out = await native().proveDepositFromLeaves(JSON.stringify(params));
  return JSON.parse(out) as CloisterProveResult;
}
