// Copyright (c) 2026 DFX AG. Licensed under the MIT License (see LICENSE).
//
// Pure (native-module-free) extData helpers for Cloister deposits. Kept separate from
// deposit.ts so the hashing can be unit-tested without loading the native prover. The
// extDataHash here is byte-for-byte identical to the contract's keccak(extData) % FIELD.

import { AbiCoder, ZeroAddress, keccak256 } from 'ethers';

// BN254 scalar field — extData hash is reduced into the field for the circuit.
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const EXTDATA_TUPLE =
  'tuple(address recipient,int256 extAmount,address relayer,uint256 fee,bytes encryptedOutput1,bytes encryptedOutput2)';

export function depositExtData(amount: string) {
  return {
    recipient: ZeroAddress,
    extAmount: amount,
    relayer: ZeroAddress,
    fee: '0',
    encryptedOutput1: '0x',
    encryptedOutput2: '0x',
  };
}

export function extDataHashOf(ext: ReturnType<typeof depositExtData>): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    [EXTDATA_TUPLE],
    [
      [
        ext.recipient,
        ext.extAmount,
        ext.relayer,
        ext.fee,
        ext.encryptedOutput1,
        ext.encryptedOutput2,
      ],
    ],
  );
  return (BigInt(keccak256(encoded)) % FIELD).toString();
}
