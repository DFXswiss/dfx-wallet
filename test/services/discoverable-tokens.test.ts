import {
  DISCOVERABLE_COINGECKO_IDS,
  DISCOVERABLE_TOKENS,
  DISCOVERABLE_TOKENS_BY_CHAIN,
} from '../../src/config/discoverable-tokens';

const SUPPORTED_CHAINS = new Set(['ethereum', 'arbitrum', 'polygon', 'base']);

describe('DISCOVERABLE_TOKENS', () => {
  it('only references chains the on-chain discovery hook can fetch', () => {
    for (const t of DISCOVERABLE_TOKENS) {
      expect(SUPPORTED_CHAINS.has(t.chain)).toBe(true);
    }
  });

  it('has a valid 0x-prefixed ERC-20 address per entry', () => {
    for (const t of DISCOVERABLE_TOKENS) {
      expect(t.contract).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }
  });

  it('has a CoinGecko id on every entry — the discovery filter relies on it', () => {
    for (const t of DISCOVERABLE_TOKENS) {
      expect(typeof t.coingeckoId).toBe('string');
      expect(t.coingeckoId.length).toBeGreaterThan(0);
    }
  });

  it('uses positive integer decimals so balance formatting never crashes', () => {
    for (const t of DISCOVERABLE_TOKENS) {
      expect(Number.isInteger(t.decimals)).toBe(true);
      expect(t.decimals).toBeGreaterThan(0);
    }
  });

  it('does not repeat the same (chain, contract) — otherwise the EVM-fetcher specs collide', () => {
    const seen = new Set<string>();
    for (const t of DISCOVERABLE_TOKENS) {
      const key = `${t.chain}:${t.contract.toLowerCase()}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('groups tokens by chain — every chain entry covers every token on that chain', () => {
    for (const t of DISCOVERABLE_TOKENS) {
      const list = DISCOVERABLE_TOKENS_BY_CHAIN.get(t.chain) ?? [];
      expect(list).toContain(t);
    }
  });

  it('exposes a deduplicated CoinGecko id list for the pricing warm-up call', () => {
    const set = new Set(DISCOVERABLE_COINGECKO_IDS);
    expect(set.size).toBe(DISCOVERABLE_COINGECKO_IDS.length);
    // Sanity: every id appears in the raw list at least once.
    for (const id of DISCOVERABLE_COINGECKO_IDS) {
      expect(DISCOVERABLE_TOKENS.some((t) => t.coingeckoId === id)).toBe(true);
    }
  });
});
