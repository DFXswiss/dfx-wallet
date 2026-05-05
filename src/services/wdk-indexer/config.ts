import { env } from '@/config/env';
import type { IndexerConfig } from './types';

/**
 * Returns indexer credentials when both `EXPO_PUBLIC_WDK_INDEXER_BASE_URL`
 * and `EXPO_PUBLIC_WDK_INDEXER_API_KEY` are set, `null` otherwise.
 *
 * The indexer is optional infrastructure: balances and address derivation
 * work without it (via direct RPC calls), so callers must treat `null` as
 * "feature disabled" rather than "configuration error".
 */
export const getIndexerConfig = (): IndexerConfig | null => {
  const baseUrl = env.wdkIndexerBaseUrl.trim().replace(/\/+$/, '');
  const apiKey = env.wdkIndexerApiKey.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
};

/** Convenience boolean for early-returns in hooks. */
export const isIndexerConfigured = (): boolean => getIndexerConfig() !== null;
