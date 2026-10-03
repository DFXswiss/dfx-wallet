import { bech32, bech32m, type BechLib, type Decoded } from 'bech32';
import bs58check from 'bs58check';

const BITCOIN_BECH32_LIMIT = 90;
const SPARK_BECH32_LIMIT = 1023;

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
 * Identifies checksum-valid Spark mainnet Bech32m addresses. This does not
 * verify whether the destination exists.
 */
export function isSparkMainnetAddress(value: string): boolean {
  const address = value.trim();
  const decoded = bech32m.decodeUnsafe(address, SPARK_BECH32_LIMIT);
  return decoded?.prefix === 'spark' || decoded?.prefix === 'sp';
}
