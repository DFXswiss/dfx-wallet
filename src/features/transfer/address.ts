import { getAddress, isAddress, ZeroAddress } from 'ethers';

import { isBitcoinOnChainAddress, isSparkMainnetAddress } from '@/services/bitcoin-address';
import { toEip55Address } from '@/services/evm/address';

/**
 * Pure helpers for recipient input on the send screen: what counts as a
 * plausible address, whether the text is an IBAN (routed to the cash-out
 * flow), and how a scanned / pasted string is cleaned up.
 */

export type AddressKind = 'evm' | 'other';

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
 * The send screen rejects the zero address whenever `ethers` can read it:
 * `0x` plus 40 zeros, the same 40 hex digits without the prefix, and the
 * ICAP form. `isEvmAddress` only sees the `0x` form, so the other two are
 * rejected here as well.
 */
function isZeroEvmAddress(value: string): boolean {
  if (!isAddress(value)) return false;
  return getAddress(value) === ZeroAddress;
}

/**
 * Format sanity check, not proof of ownership. True only for a non-zero EVM
 * address, a mainnet Bitcoin on-chain address, or a plain Spark mainnet address.
 */
export function isPlausibleAddress(value: string): boolean {
  const candidate = value.trim();
  if (/\s/.test(candidate) || isZeroEvmAddress(candidate)) return false;
  return (
    isEvmAddress(candidate) ||
    isBitcoinOnChainAddress(candidate) ||
    isSparkMainnetAddress(candidate)
  );
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
  const compact = value.replace(/\s/g, '');
  // ICAP addresses use the XE prefix and otherwise match the IBAN shape.
  // XE is not an IBAN country code, so they stay on the address path.
  if (compact.startsWith('XE')) return false;
  return IBAN_PATTERN.test(compact);
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
