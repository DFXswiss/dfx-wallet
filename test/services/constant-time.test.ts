import { constantTimeEqual } from '../../src/services/security/constant-time';

describe('constantTimeEqual', () => {
  it('accepts identical strings', () => {
    expect(constantTimeEqual('matching value', 'matching value')).toBe(true);
  });

  it('rejects different strings of equal length', () => {
    expect(constantTimeEqual('first value', 'other value')).toBe(false);
  });

  it('rejects strings of different lengths', () => {
    expect(constantTimeEqual('short', 'shorter')).toBe(false);
  });

  it('accepts empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('rejects strings that differ by one character', () => {
    expect(constantTimeEqual('same-prefix-a', 'same-prefix-b')).toBe(false);
  });
});
