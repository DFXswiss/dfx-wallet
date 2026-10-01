const BECH32_ADDRESS = /^(bc1[qp]|tb1[qp])[02-9ac-hj-np-z]{8,87}$/i;
const MAINNET_LEGACY = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const TESTNET_LEGACY = /^[mn2][1-9A-HJ-NP-Za-km-z]{25,34}$/;

/**
 * Identifies Bitcoin on-chain destination formats supported by the WDK
 * Bitcoin account. Bech32 addresses must not mix upper and lower case.
 */
export function isBitcoinOnChainAddress(value: string): boolean {
  const address = value.trim();
  if (BECH32_ADDRESS.test(address)) {
    return address === address.toLowerCase() || address === address.toUpperCase();
  }
  return MAINNET_LEGACY.test(address) || TESTNET_LEGACY.test(address);
}
