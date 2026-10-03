const MAINNET_BECH32 = /^bc1[qp][02-9ac-hj-np-z]{8,87}$/i;
const MAINNET_LEGACY = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const SPARK_MAINNET_BECH32M = /^(spark|sp)1[02-9ac-hj-np-z]{40,}$/i;

/**
 * Identifies mainnet Bitcoin on-chain destination formats supported by the
 * configured WDK Bitcoin account. Bech32 addresses must not mix case.
 */
export function isBitcoinOnChainAddress(value: string): boolean {
  const address = value.trim();
  if (MAINNET_BECH32.test(address)) {
    return address === address.toLowerCase() || address === address.toUpperCase();
  }
  return MAINNET_LEGACY.test(address);
}

/**
 * Identifies Spark mainnet addresses by format only; it does not verify the
 * Bech32m checksum or whether the destination exists.
 */
export function isSparkMainnetAddress(value: string): boolean {
  const address = value.trim();
  if (!SPARK_MAINNET_BECH32M.test(address)) return false;
  return address === address.toLowerCase() || address === address.toUpperCase();
}
