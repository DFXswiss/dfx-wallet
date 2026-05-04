import { Passkey, type PasskeyCreateResult, type PasskeyGetResult } from 'react-native-passkey';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

const RP_ID = 'dfx.swiss';
const RP_NAME = 'DFX Wallet';

const PRF_SALT = 'dfx-wallet-v1';

/**
 * Check if passkeys with PRF extension are likely supported on this device.
 *
 * Combines two checks:
 * 1. Passkey.isSupported() — native library check for platform authenticator capability
 * 2. OS version gate — PRF requires iOS 18+ or Android 14+ (API 34)
 *
 * Note: PRF support cannot be verified without attempting a passkey operation.
 * If the device passes both checks but PRF is unavailable at runtime,
 * PasskeyPrfUnsupportedError is thrown and the UI redirects to the seed flow.
 */
export function isPasskeySupported(): boolean {
  if (!Passkey.isSupported()) return false;

  if (Platform.OS === 'ios') {
    const version = parseInt(Platform.Version as string, 10);
    return version >= 18;
  }
  if (Platform.OS === 'android') {
    return typeof Platform.Version === 'number' && Platform.Version >= 34;
  }
  return false;
}

/**
 * Compute the PRF salt as a Uint8Array from the static salt string.
 */
async function getPrfSalt(): Promise<Uint8Array> {
  const hashHex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, PRF_SALT);
  return new Uint8Array(hashHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

/**
 * Decode a Base64URL string to Uint8Array.
 */
function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array(binary.split('').map((c) => c.charCodeAt(0)));
}

/**
 * Encode a Uint8Array to Base64URL string.
 */
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Extract the PRF output from a passkey result.
 * The PRF results contain the first (and optionally second) values as Uint8Array.
 */
function extractPrfOutput(result: PasskeyCreateResult | PasskeyGetResult): Uint8Array {
  const prfResults = result.clientExtensionResults?.prf?.results;
  if (!prfResults?.first) {
    throw new PasskeyPrfUnsupportedError();
  }

  const first = prfResults.first;
  if (first instanceof Uint8Array) {
    return first;
  }

  // Handle case where result is base64url-encoded string
  if (typeof first === 'string') {
    return base64UrlToUint8Array(first);
  }

  // Handle ArrayBuffer-like object with numeric keys
  if (typeof first === 'object') {
    const values = Object.values(first as Record<string, number>);
    return new Uint8Array(values);
  }

  throw new PasskeyPrfUnsupportedError();
}

/**
 * Create a new passkey and evaluate the PRF extension to derive wallet entropy.
 * Returns the raw PRF output (32 bytes) as a Uint8Array.
 */
export async function createPasskey(): Promise<{ prfOutput: Uint8Array; credentialId: string }> {
  const userId = uint8ArrayToBase64Url(Crypto.getRandomBytes(16));
  const challenge = uint8ArrayToBase64Url(Crypto.getRandomBytes(32));
  const prfSalt = await getPrfSalt();

  const result: PasskeyCreateResult = await Passkey.create({
    rp: {
      id: RP_ID,
      name: RP_NAME,
    },
    user: {
      id: userId,
      name: RP_NAME,
      displayName: RP_NAME,
    },
    challenge,
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
    extensions: {
      prf: {
        eval: {
          first: prfSalt,
        },
      },
    },
  });

  return {
    prfOutput: extractPrfOutput(result),
    credentialId: result.id,
  };
}

/**
 * Authenticate with an existing passkey and evaluate PRF to re-derive wallet entropy.
 * Returns the raw PRF output (32 bytes) as a Uint8Array.
 */
export async function authenticatePasskey(): Promise<{
  prfOutput: Uint8Array;
  credentialId: string;
}> {
  const challenge = uint8ArrayToBase64Url(Crypto.getRandomBytes(32));
  const prfSalt = await getPrfSalt();

  const result: PasskeyGetResult = await Passkey.get({
    rpId: RP_ID,
    challenge,
    userVerification: 'required',
    extensions: {
      prf: {
        eval: {
          first: prfSalt,
        },
      },
    },
  });

  return {
    prfOutput: extractPrfOutput(result),
    credentialId: result.id,
  };
}

export class PasskeyPrfUnsupportedError extends Error {
  constructor() {
    super('PRF extension not supported by this authenticator');
    this.name = 'PasskeyPrfUnsupportedError';
  }
}
