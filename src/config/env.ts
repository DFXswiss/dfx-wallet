export const env = {
  dfxApiUrl: process.env.EXPO_PUBLIC_DFX_API_URL ?? 'https://api.dfx.swiss/v1',
  wdkIndexerUrl: process.env.EXPO_PUBLIC_WDK_INDEXER_URL ?? 'https://wdk-api.tether.io',
  wdkIndexerApiKey: process.env.EXPO_PUBLIC_WDK_INDEXER_API_KEY ?? '',
} as const;
