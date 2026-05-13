import { toEip55Address } from '../../src/services/evm/address';

describe('toEip55Address', () => {
  it('matches EIP-55 checksum examples', () => {
    expect(toEip55Address('0x52908400098527886e0f7030069857d2e4169ee7')).toBe(
      '0x52908400098527886E0F7030069857D2E4169EE7',
    );
    expect(toEip55Address('0xde709f2102306220921060314715629080e2fb77')).toBe(
      '0xde709f2102306220921060314715629080e2fb77',
    );
    expect(toEip55Address('0x5aeda56215b167893e80b4fe645ba6d5bab767de')).toBe(
      '0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE',
    );
  });

  it('rejects malformed addresses', () => {
    expect(() => toEip55Address('bc1qabc')).toThrow(/Invalid EVM address/);
  });
});
