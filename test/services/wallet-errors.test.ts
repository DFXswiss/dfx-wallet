import { isWalletAlreadyExistsError } from '@/services/wallet/wallet-errors';

describe('isWalletAlreadyExistsError', () => {
  // Red mutation: drop the lower-case normalization before matching.
  it('recognises already-exists errors case-insensitively within a longer message', () => {
    expect(isWalletAlreadyExistsError(new Error('Wallet ALREADY EXISTS for this identifier'))).toBe(
      true,
    );
  });

  // Red mutation: accept values that are not Error instances based on a message-like shape.
  it.each(['Wallet already exists', { message: 'Wallet already exists' }, null, undefined])(
    'rejects non-Error value %p',
    (value) => {
      expect(isWalletAlreadyExistsError(value)).toBe(false);
    },
  );

  // Red mutation: widen the match from the exact already-exists phrase to unrelated wallet errors.
  it('rejects unrelated Error messages', () => {
    expect(isWalletAlreadyExistsError(new Error('Wallet creation failed'))).toBe(false);
  });
});
