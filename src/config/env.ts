export const env = {
  dfxApiUrl: process.env.EXPO_PUBLIC_DFX_API_URL ?? 'https://api.dfx.swiss',
  /**
   * Etherscan V2 unified API key. Without it the explorer-driven token
   * discovery + transaction feed degrade gracefully — discovery falls
   * back to the curated `DISCOVERABLE_TOKENS` list and the TX feed
   * returns empty. Free-tier signup at https://etherscan.io/apis gives
   * 100k calls/day / 5 calls/sec.
   */
  etherscanApiKey: process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY ?? '',
} as const;
