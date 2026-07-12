// Copyright (c) 2026 DFX AG. Licensed under the MIT License (see LICENSE).
//
// Cross-stack known-answer test: the wallet's extDataHash must equal the value the
// Solidity contract and the Go prover compute (keccak(extData) % FIELD). Guards against
// ABI-encoding / field-reduction drift across the TS ↔ Solidity ↔ Go boundary.

import { depositExtData, extDataHashOf } from '@/features/cloister/extData';

describe('cloister extData hashing', () => {
  it('matches the on-chain keccak(extData) % FIELD for a 250-unit deposit (KAT)', () => {
    const hash = extDataHashOf(depositExtData('250'));
    expect(hash).toBe(
      '7614026865930904519014588104089565333166817284352892234246069497205054735710',
    );
  });

  it('produces a field element below the BN254 scalar field', () => {
    const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    expect(BigInt(extDataHashOf(depositExtData('999999')))).toBeLessThan(FIELD);
  });

  it('is deterministic for the same amount', () => {
    expect(extDataHashOf(depositExtData('42'))).toBe(extDataHashOf(depositExtData('42')));
  });
});
