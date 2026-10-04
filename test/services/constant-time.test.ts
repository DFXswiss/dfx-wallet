import { constantTimeEqual } from '@/services/security/constant-time';

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('same-token', 'same-token')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(constantTimeEqual('same-token', 'diff-token')).toBe(false);
  });

  it('returns false for strings of different lengths', () => {
    expect(constantTimeEqual('short', 'longer')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('returns false for strings that differ in exactly one character', () => {
    expect(constantTimeEqual('token-a', 'token-b')).toBe(false);
  });
});
