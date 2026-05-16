// audit-skip-file: ethXpub mention here is the BIP32 re-derivation
// gate — closes the CC-7 trust-the-device-address gap. No signing.

/**
 * Re-derive an ETH address client-side from the device's extended public
 * key, and compare against what the device returned. Closes CC-7: the
 * pairing flow no longer trusts the device-returned address string
 * blindly. A malicious WASM or compromised firmware that returns an
 * attacker address is caught here.
 *
 * Algorithm:
 *   1. Split the derivation path into a parent (everything up to and
 *      including the last hardened segment) and a non-hardened child
 *      suffix. BIP44 ETH paths look like m/44'/60'/A'/0/N, so parent is
 *      m/44'/60'/A' and suffix is "0/N".
 *   2. Fetch the parent xpub from the device via ethXpub.
 *   3. Publicly derive the suffix using @noble/curves secp256k1 + BIP32
 *      (ethers wraps this in HDNodeWallet.fromExtendedKey).
 *   4. The Ethereum address is keccak256(uncompressed_pubkey_without_04_prefix).slice(-20).
 *   5. Compare lowercased addresses.
 */

import { HDNodeWallet, getAddress } from 'ethers';
import { HwAddressMismatchError } from './errors';

/**
 * Parse a BIP32 keypath into (parent, suffix) such that suffix contains
 * only non-hardened segments. Throws if no non-hardened tail exists.
 */
export function splitDerivationPath(path: string): { parent: string; suffix: string } {
  if (!path.startsWith('m/')) {
    throw new Error(`derivationPath must start with "m/": ${path}`);
  }
  const segments = path.slice(2).split('/');
  let lastHardened = -1;
  for (let i = 0; i < segments.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- i is bounded by segments.length
    if (segments[i]!.endsWith("'")) lastHardened = i;
  }
  if (lastHardened === segments.length - 1) {
    throw new Error(`derivationPath has no non-hardened tail; cannot re-derive publicly: ${path}`);
  }
  const parentParts = segments.slice(0, lastHardened + 1);
  const suffixParts = segments.slice(lastHardened + 1);
  return {
    parent: 'm/' + parentParts.join('/'),
    suffix: suffixParts.join('/'),
  };
}

/**
 * Verify that the device-returned address matches what we independently
 * derive from the device's xpub. Throws HwAddressMismatchError on
 * disagreement.
 *
 * Returns the EIP-55-checksummed expected address — callers should
 * surface this in the UI instead of the raw device-returned string so
 * a homoglyph-style mutation (lowercase O vs 0) is impossible.
 */
export async function verifyEthAddressByXpub(args: {
  derivationPath: string;
  deviceReturnedAddress: string;
  fetchXpub: (parentPath: string) => Promise<string>;
}): Promise<string> {
  const { parent, suffix } = splitDerivationPath(args.derivationPath);
  const xpub = await args.fetchXpub(parent);
  // HDNodeWallet.fromExtendedKey returns a public-only HDNode for an
  // xpub; .derivePath does the public BIP32 child derivation.
  const parentNode = HDNodeWallet.fromExtendedKey(xpub);
  const childNode = parentNode.derivePath(suffix);
  // `.address` is EIP-55 checksummed.
  const derived = childNode.address;
  // Compare case-insensitively (the BitBox firmware historically
  // returned lowercase addresses; modern firmware returns EIP-55).
  const normalisedDevice = getAddress(args.deviceReturnedAddress);
  if (derived !== normalisedDevice) {
    throw new HwAddressMismatchError(derived, normalisedDevice);
  }
  return derived;
}
