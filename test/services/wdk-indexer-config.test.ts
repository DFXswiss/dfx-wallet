describe('wdk-indexer/config', () => {
  // `getIndexerConfig` reads `process.env` indirectly through `src/config/env`.
  // The env module's `env` object is captured once at import time, so we have
  // to clear the module cache between cases to make changes take effect.
  const ORIGINAL_ENV = process.env;

  const loadConfigModule = async () => {
    let mod!: typeof import('../../src/services/wdk-indexer/config');
    await jest.isolateModulesAsync(async () => {
      mod = await import('../../src/services/wdk-indexer/config');
    });
    return mod;
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.EXPO_PUBLIC_WDK_INDEXER_BASE_URL;
    delete process.env.EXPO_PUBLIC_WDK_INDEXER_API_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns null when the API key is missing (base URL alone is not enough)', async () => {
    process.env.EXPO_PUBLIC_WDK_INDEXER_BASE_URL = 'https://wdk-api.tether.io';
    const { getIndexerConfig, isIndexerConfigured } = await loadConfigModule();
    expect(getIndexerConfig()).toBeNull();
    expect(isIndexerConfigured()).toBe(false);
  });

  it('returns null when the API key is the empty string (env files often ship an empty placeholder)', async () => {
    process.env.EXPO_PUBLIC_WDK_INDEXER_BASE_URL = 'https://wdk-api.tether.io';
    process.env.EXPO_PUBLIC_WDK_INDEXER_API_KEY = '';
    const { getIndexerConfig } = await loadConfigModule();
    expect(getIndexerConfig()).toBeNull();
  });

  it('returns the resolved config when both env vars are set', async () => {
    process.env.EXPO_PUBLIC_WDK_INDEXER_BASE_URL = 'https://wdk-api.tether.io';
    process.env.EXPO_PUBLIC_WDK_INDEXER_API_KEY = 'sk_test_key';
    const { getIndexerConfig, isIndexerConfigured } = await loadConfigModule();
    expect(getIndexerConfig()).toEqual({
      baseUrl: 'https://wdk-api.tether.io',
      apiKey: 'sk_test_key',
    });
    expect(isIndexerConfigured()).toBe(true);
  });

  it('strips trailing slashes from the base URL so consumers can safely concatenate paths', async () => {
    process.env.EXPO_PUBLIC_WDK_INDEXER_BASE_URL = 'https://wdk-api.tether.io///';
    process.env.EXPO_PUBLIC_WDK_INDEXER_API_KEY = 'sk_test_key';
    const { getIndexerConfig } = await loadConfigModule();
    expect(getIndexerConfig()?.baseUrl).toBe('https://wdk-api.tether.io');
  });
});
