import * as Crypto from 'expo-crypto';
import { argon2idAsync } from '@noble/hashes/argon2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const LEGACY_SALT = 'dfx-wallet-pin-v1';
const LEGACY_ITERATIONS = 10000;
const FORMAT = 'pin$argon2id';
const VERSION = 19;
const ARGON2_PARAMS = {
  t: 3,
  m: 32768,
  p: 1,
  dkLen: 32,
} as const;
const SALT_BYTES = 16;

/**
 * Hash a PIN using Argon2id with a per-record random salt.
 *
 * Stored format:
 * pin$argon2id$v=19$m=32768,t=3,p=1$<saltHex>$<hashHex>
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = Crypto.getRandomBytes(SALT_BYTES);
  const hash = await argon2idAsync(pin, salt, ARGON2_PARAMS);
  return `${FORMAT}$v=${VERSION}$m=${ARGON2_PARAMS.m},t=${ARGON2_PARAMS.t},p=${ARGON2_PARAMS.p}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

/**
 * Verify a PIN against a stored hash.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (isCurrentPinHash(storedHash)) {
    return verifyArgon2Pin(pin, storedHash);
  }

  if (isLegacyPinHash(storedHash)) {
    const hash = await legacyHashPin(pin);
    return timingSafeEqual(hash, storedHash);
  }

  return false;
}

export function needsPinRehash(storedHash: string): boolean {
  return !isCurrentPinHash(storedHash) && isLegacyPinHash(storedHash);
}

function isCurrentPinHash(storedHash: string): boolean {
  return storedHash.startsWith(`${FORMAT}$`);
}

function isLegacyPinHash(storedHash: string): boolean {
  return /^[0-9a-f]+$/i.test(storedHash);
}

async function verifyArgon2Pin(pin: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6) return false;

  const [, algorithm, versionPart, paramsPart, saltHex, hashHex] = parts;
  if (!algorithm || !versionPart || !paramsPart || !saltHex || !hashHex) return false;
  if (`pin$${algorithm}` !== FORMAT || versionPart !== `v=${VERSION}`) return false;

  const params = parseParams(paramsPart);
  if (!params) return false;

  try {
    const salt = hexToBytes(saltHex);
    const expected = hexToBytes(hashHex);
    if (salt.length !== SALT_BYTES || expected.length !== ARGON2_PARAMS.dkLen) return false;

    const actual = await argon2idAsync(pin, salt, {
      ...params,
      dkLen: expected.length,
    });
    return timingSafeEqualBytes(actual, expected);
  } catch {
    return false;
  }
}

function parseParams(value: string): { m: number; t: number; p: number } | null {
  const parsed = Object.fromEntries(
    value.split(',').map((entry) => {
      const [key, raw] = entry.split('=');
      return [key, Number(raw)];
    }),
  );

  const { m, t, p } = parsed;
  if (!Number.isSafeInteger(m) || !Number.isSafeInteger(t) || !Number.isSafeInteger(p)) return null;
  if (m < 19456 || t < 2 || p < 1) return null;
  return { m, t, p };
}

async function legacyHashPin(pin: string): Promise<string> {
  let hash = `${LEGACY_SALT}:${pin}`;
  for (let i = 0; i < LEGACY_ITERATIONS; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hash);
  }
  return hash;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  a.forEach((value, index) => {
    result |= value ^ b.at(index)!;
  });
  return result === 0;
}
