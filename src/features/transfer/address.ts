import { toEip55Address } from '@/services/evm/address';

/**
 * Pure helpers for recipient input on the send screen: what counts as a
 * plausible address, whether the text is an IBAN (routed to the cash-out
 * flow), and how a scanned / pasted string is cleaned up.
 */

export type AddressKind = 'evm' | 'other';

// Shortest address the old send screen accepted (`recipient.length >= 26`):
// a legacy Bitcoin address is 26 characters long.
const MIN_ADDRESS_LENGTH = 26;
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

/** Strip the `ethereum:` / `bitcoin:` URI scheme and any `?query` from a scanned or pasted string. */
export function normalizeAddressInput(raw: string): string {
  const withoutScheme = raw.trim().replace(/^(ethereum|bitcoin):/, '');
  // String.prototype.split always yields at least one element, so [0] is defined.
  return withoutScheme.split('?')[0]!;
}

export function isEvmAddress(value: string): boolean {
  if (!value.startsWith('0x')) return false;
  try {
    toEip55Address(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format sanity check, not proof of ownership. Any 0x-prefixed string must be
 * a well-formed EVM address (the existing helper rejects everything else);
 * other strings keep the previous rule: no whitespace, at least 26 characters.
 */
export function isPlausibleAddress(value: string): boolean {
  const candidate = value.trim();
  if (/\s/.test(candidate)) return false;
  if (candidate.startsWith('0x')) return isEvmAddress(candidate);
  return candidate.length >= MIN_ADDRESS_LENGTH;
}

export function getAddressKind(address: string): AddressKind {
  return address.trim().startsWith('0x') ? 'evm' : 'other';
}

/** Same address? EVM addresses compare case-insensitively (checksum casing is cosmetic). */
export function addressesEqual(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (left.startsWith('0x') && right.startsWith('0x')) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

export function isIban(value: string): boolean {
  return IBAN_PATTERN.test(value.replace(/\s/g, ''));
}

/** `bc1qq0jv…66ujdm` — shortened for lists and headers; short strings pass through. */
export function shortenAddress(address: string, head = 8, tail = 6): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** `CH93 •••• 2257` — first four and last four characters of an IBAN. */
export function maskIban(iban: string): string {
  const compact = iban.replace(/\s/g, '');
  if (compact.length <= 8) return compact;
  return `${compact.slice(0, 4)} •••• ${compact.slice(-4)}`;
}
