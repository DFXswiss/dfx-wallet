export const env = {
  dfxApiUrl: process.env.EXPO_PUBLIC_DFX_API_URL ?? 'https://api.dfx.swiss/v1',
  /**
   * WDK Indexer REST API. Both fields must be present for the indexer to be
   * considered "configured" — the base URL has a sensible default but the
   * API key has no fallback. See `src/services/wdk-indexer/config.ts`.
   *
   * Defaults source: https://docs.wdk.tether.io/start-building/react-native-quickstart
   */
  wdkIndexerBaseUrl: process.env.EXPO_PUBLIC_WDK_INDEXER_BASE_URL ?? 'https://wdk-api.tether.io',
  wdkIndexerApiKey: process.env.EXPO_PUBLIC_WDK_INDEXER_API_KEY ?? '',
} as const;
