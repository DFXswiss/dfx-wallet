export function getQuoteErrorCode(
  info: { isValid?: boolean; error?: string; errors?: string[] } | null,
): string | null {
  const error = info?.error ?? info?.errors?.[0];
  return error !== undefined ? String(error) : null;
}

export function getPaymentInfoErrorCode(
  info: { isValid: boolean; error?: string; errors?: string[] } | null,
): string | null {
  if (!info || info.isValid) return null;
  const error = info.error ?? info.errors?.[0];
  return error !== undefined ? String(error) : 'noCode';
}

export function canAdvanceToPayment(info: { isValid: boolean } | null): boolean {
  return info?.isValid === true;
}
