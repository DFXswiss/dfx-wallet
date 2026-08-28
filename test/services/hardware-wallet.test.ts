import { ethSignatureToHex } from '../../src/features/hardware-wallet/services/bitbox-protocol';

describe('BitBox Protocol', () => {
  describe('ethSignatureToHex', () => {
    it('should convert Uint8Array signature to hex strings', () => {
      const sig = {
        r: new Uint8Array([0x01, 0x02, 0x03]),
        s: new Uint8Array([0xaa, 0xbb, 0xcc]),
        v: new Uint8Array([0x1b]),
      };

      const result = ethSignatureToHex(sig);

      expect(result.r).toBe('0x010203');
      expect(result.s).toBe('0xaabbcc');
      expect(result.v).toBe(27);
    });

    it('should handle 32-byte r and s values', () => {
      const r = new Uint8Array(32).fill(0xff);
      const s = new Uint8Array(32).fill(0x00);

      const result = ethSignatureToHex({ r, s, v: new Uint8Array([0x1c]) });

      expect(result.r).toBe('0x' + 'ff'.repeat(32));
      expect(result.s).toBe('0x' + '00'.repeat(32));
      expect(result.v).toBe(28);
    });
  });
});
