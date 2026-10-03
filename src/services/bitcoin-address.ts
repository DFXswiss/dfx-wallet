import { bech32, bech32m, type BechLib, type Decoded } from 'bech32';
import bs58check from 'bs58check';
import { SigningKey } from 'ethers';

const BITCOIN_BECH32_LIMIT = 90;
const SPARK_BECH32_LIMIT = 1023;
const SPARK_IDENTITY_KEY_LENGTH = 33;
const SPARK_PLAIN_PAYLOAD_LENGTH = 35;

function isValidWitnessProgram(decoded: Decoded, encoding: BechLib): boolean {
  if (decoded.prefix !== 'bc' || decoded.words.length < 2) return false;

  const [version, ...programWords] = decoded.words;
  const program = encoding.fromWordsUnsafe(programWords);
  if (version === undefined || program === undefined) return false;

  if (version === 0) {
    return encoding === bech32 && (program.length === 20 || program.length === 32);
  }

  return version <= 16 && encoding === bech32m && program.length >= 2 && program.length <= 40;
}

function isMainnetSegwitAddress(address: string): boolean {
  const bech32Decoded = bech32.decodeUnsafe(address, BITCOIN_BECH32_LIMIT);
  if (bech32Decoded && isValidWitnessProgram(bech32Decoded, bech32)) return true;

  const bech32mDecoded = bech32m.decodeUnsafe(address, BITCOIN_BECH32_LIMIT);
  return Boolean(bech32mDecoded && isValidWitnessProgram(bech32mDecoded, bech32m));
}

function isMainnetLegacyAddress(address: string): boolean {
  const decoded = bs58check.decodeUnsafe(address);
  return Boolean(decoded && decoded.length === 21 && (decoded[0] === 0x00 || decoded[0] === 0x05));
}

/**
 * Identifies mainnet Bitcoin on-chain destination formats supported by the
 * configured WDK Bitcoin account. Bech32 addresses must not mix case.
 */
export function isBitcoinOnChainAddress(value: string): boolean {
  const address = value.trim();
  return isMainnetSegwitAddress(address) || isMainnetLegacyAddress(address);
}

/**
 * Mirrors the Spark SDK decoder for plain mainnet transfer addresses. Invoice
 * addresses are rejected. This does not verify whether the destination exists.
 */
export function isSparkMainnetAddress(value: string): boolean {
  try {
    const decoded = bech32m.decodeUnsafe(value.trim(), SPARK_BECH32_LIMIT);
    if (!decoded || (decoded.prefix !== 'spark' && decoded.prefix !== 'sp')) return false;

    const payload = bech32m.fromWordsUnsafe(decoded.words);
    if (
      !payload ||
      payload.length !== SPARK_PLAIN_PAYLOAD_LENGTH ||
      payload[0] !== 0x0a ||
      payload[1] !== SPARK_IDENTITY_KEY_LENGTH
    ) {
      return false;
    }

    const identityPublicKey = Uint8Array.from(payload.slice(2, 2 + SPARK_IDENTITY_KEY_LENGTH));
    if (identityPublicKey[0] !== 0x02 && identityPublicKey[0] !== 0x03) return false;

    const inputKeyHex = Array.from(identityPublicKey, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const compressedKey = SigningKey.computePublicKey(identityPublicKey, true);
    return compressedKey === `0x${inputKeyHex}`;
  } catch {
    return false;
  }
}
