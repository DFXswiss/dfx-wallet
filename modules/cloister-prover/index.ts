// Copyright (c) 2026 DFX AG. All rights reserved. Proprietary and confidential.
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
  depositDirect(paramsJSON: string): Promise<string>;
}

export interface CloisterDepositDirectParams {
  rpc: string;
  pool: string;
  token: string;
  deployerKey: string;
  amount: string;
  ownerPriv: string;
  /** Pool deploy block — native tree-sync scans NewCommitment events from here. */
  fromBlock?: number;
}

export interface CloisterDepositDirectResult {
  txHash: string;
  basescan: string;
  proveMs: number;
}

// Throws at import time only if the native module is entirely absent (e.g. running
// in an Expo Go client without the dev build). Callers should feature-detect via
// `isCloisterNativeAvailable()`.
let _native: CloisterProverNative | null = null;
function native(): CloisterProverNative {
  if (!_native) _native = requireNativeModule('CloisterProver');
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

/** Prove a deposit on-device AND broadcast it directly to a public RPC (no relayer/LAN). */
export async function depositDirect(params: CloisterDepositDirectParams): Promise<CloisterDepositDirectResult> {
  const out = await native().depositDirect(JSON.stringify(params));
  return JSON.parse(out) as CloisterDepositDirectResult;
}
