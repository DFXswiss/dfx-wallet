import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function toEip55Address(address: string): string {
  if (!EVM_ADDRESS_RE.test(address)) {
    throw new Error('Invalid EVM address');
  }

  const lower = address.slice(2).toLowerCase();
  const hash = bytesToHex(keccak_256(utf8ToBytes(lower)));
  let checksummed = '0x';

  for (let i = 0; i < lower.length; i += 1) {
    const char = lower.charAt(i);
    const nibble = Number.parseInt(hash.charAt(i), 16);
    checksummed += nibble >= 8 ? char.toUpperCase() : char;
  }

  return checksummed;
}
