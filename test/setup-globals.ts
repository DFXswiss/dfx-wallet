import { webcrypto } from 'crypto';

// bip39 needs crypto.getRandomValues
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}
