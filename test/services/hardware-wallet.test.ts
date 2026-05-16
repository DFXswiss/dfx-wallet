import { ethSignatureToHex } from '../../src/features/hardware-wallet/services/bitbox-protocol';

describe('BitBox Protocol — ethSignatureToHex', () => {
  it('hex-encodes 32-byte r and s, single-byte v (mainnet, chainId=1)', () => {
    const r = new Uint8Array(32);
    r[0] = 0x01;
    const s = new Uint8Array(32);
    s[0] = 0xaa;
    const result = ethSignatureToHex({
      r,
      s,
      v: new Uint8Array([0x1b]),
    });
    expect(result.r).toBe('0x01' + '00'.repeat(31));
    expect(result.s).toBe('0xaa' + '00'.repeat(31));
    expect(result.v).toBe(27);
  });

  it('handles 32-byte r and s values', () => {
    const r = new Uint8Array(32).fill(0xff);
    const s = new Uint8Array(32).fill(0x00);
    const result = ethSignatureToHex({ r, s, v: new Uint8Array([0x1c]) });
    expect(result.r).toBe('0x' + 'ff'.repeat(32));
    expect(result.s).toBe('0x' + '00'.repeat(32));
    expect(result.v).toBe(28);
  });

  /**
   * Regression for CC-5 (audit show-stopper).
   *
   * The previous implementation returned `sig.v[0]!` — silently dropping
   * every byte past the first. For any EIP-155 chainId greater than 110
   * (Polygon=137, Arbitrum=42161, Optimism=10, BSC=56 — every production
   * L2 the wallet may target), v = 2*chainId + 35 + parity exceeds 255
   * and spans two or more bytes. The truncated v either failed to
   * broadcast or, worse, recovered to a signer for the WRONG chain.
   *
   * Post-fix: ethSignatureToHex decodes v as a big-endian integer over
   * the entire sig.v Uint8Array. The recovered numeric matches the
   * physical signature bytes.
   */
  it('decodes multi-byte v correctly for chainId > 110 (CC-5 regression)', () => {
    // chainId 137 (Polygon): v ∈ {0x0135, 0x0136} = {309, 310}.
    const r = new Uint8Array(32);
    const s = new Uint8Array(32);
    expect(ethSignatureToHex({ r, s, v: new Uint8Array([0x01, 0x35]) }).v).toBe(309);
    expect(ethSignatureToHex({ r, s, v: new Uint8Array([0x01, 0x36]) }).v).toBe(310);
    // chainId 42161 (Arbitrum): v ∈ {0x14a39, 0x14a3a} = {84,537; 84,538}.
    expect(ethSignatureToHex({ r, s, v: new Uint8Array([0x01, 0x4a, 0x39]) }).v).toBe(84_537);
  });

  it('rejects empty v as a malformed signature', () => {
    expect(() =>
      ethSignatureToHex({
        r: new Uint8Array(32),
        s: new Uint8Array(32),
        v: new Uint8Array([]),
      }),
    ).toThrow(/v must be a non-empty Uint8Array/);
  });

  it('rejects non-32-byte r and s as malformed', () => {
    expect(() =>
      ethSignatureToHex({
        r: new Uint8Array(31),
        s: new Uint8Array(32),
        v: new Uint8Array([27]),
      }),
    ).toThrow(/r must be a 32-byte/);
    expect(() =>
      ethSignatureToHex({
        r: new Uint8Array(32),
        s: new Uint8Array(33),
        v: new Uint8Array([27]),
      }),
    ).toThrow(/s must be a 32-byte/);
  });
});
