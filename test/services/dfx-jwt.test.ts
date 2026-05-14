import { decodeDfxJwt } from '../../src/features/dfx-backend/services/jwt';

const base64UrlEncode = (input: string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const buildJwt = (payload: object): string =>
  [base64UrlEncode('{}'), base64UrlEncode(JSON.stringify(payload)), base64UrlEncode('sig')].join(
    '.',
  );

describe('decodeDfxJwt', () => {
  it('decodes the account claim from a well-formed JWT', () => {
    const token = buildJwt({ account: 42, address: '0xabc', blockchains: ['Ethereum'] });
    const payload = decodeDfxJwt(token);
    expect(payload?.account).toBe(42);
    expect(payload?.address).toBe('0xabc');
  });

  it('returns null for malformed input', () => {
    expect(decodeDfxJwt('not.a.jwt')).toBeNull();
    expect(decodeDfxJwt('only-one-segment')).toBeNull();
    expect(decodeDfxJwt('')).toBeNull();
  });

  it('returns null when the payload is not valid JSON', () => {
    const token = ['{}', base64UrlEncode('not-json'), 'sig'].join('.');
    expect(decodeDfxJwt(token)).toBeNull();
  });

  it('handles base64url padding correctly', () => {
    // payload of length 5 → base64 length 8 with `=` padding stripped to 7
    const payload = JSON.stringify({ account: 1 });
    const token = buildJwt({ account: 1 });
    expect(payload.length).toBeGreaterThan(0);
    expect(decodeDfxJwt(token)?.account).toBe(1);
  });
});
