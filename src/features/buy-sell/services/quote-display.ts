export function getQuoteErrorCode(
  info: { isValid?: boolean; error?: string } | null,
): string | null {
  return info?.error ? String(info.error) : null;
}

export function getPaymentInfoErrorCode(
  info: { isValid: boolean; error?: string } | null,
): string | null {
  if (!info || info.isValid) return null;
  return info.error ? String(info.error) : 'noCode';
}

export function canAdvanceToPayment(info: { isValid: boolean } | null): boolean {
  return info?.isValid === true;
}
