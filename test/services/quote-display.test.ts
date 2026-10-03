import {
  canAdvanceToPayment,
  getPaymentInfoErrorCode,
  getQuoteErrorCode,
} from '@/features/buy-sell/services/quote-display';

describe('buy and sell quote display', () => {
  it('advances only for explicitly valid payment information', () => {
    expect(canAdvanceToPayment({ isValid: true })).toBe(true);
    expect(canAdvanceToPayment({ isValid: false })).toBe(false);
    expect(canAdvanceToPayment(null)).toBe(false);
  });

  it('does not turn an invalid quote without an error code into a visible error', () => {
    expect(getQuoteErrorCode({ isValid: false })).toBeNull();
    expect(getQuoteErrorCode({ isValid: false, error: 'KycRequired' })).toBe('KycRequired');
    expect(getQuoteErrorCode(null)).toBeNull();
  });

  it('uses the final invalid payment-info error code with a no-code fallback', () => {
    expect(getPaymentInfoErrorCode({ isValid: false, error: 'KycRequired' })).toBe('KycRequired');
    expect(getPaymentInfoErrorCode({ isValid: false })).toBe('noCode');
    expect(getPaymentInfoErrorCode({ isValid: true, error: 'KycRequired' })).toBeNull();
    expect(getPaymentInfoErrorCode(null)).toBeNull();
  });
});
