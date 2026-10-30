import { verifyMessage } from 'ethers';
import { toEip55Address } from './address';

export const EVM_AUTH_ADDRESS_PROBE_MESSAGE = 'DFX Wallet authentication address probe';

export function recoverPersonalSignAddress(message: string, signature: string): string {
  return toEip55Address(verifyMessage(message, signature));
}
