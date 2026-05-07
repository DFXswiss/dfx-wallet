import { useCallback, useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import type { ChainId } from '@/config/chains';
import { DEFAULT_ENABLED_CHAINS, IMPLICIT_ENABLED_CHAINS } from '@/config/tokens';

const STORAGE_KEY = 'portfolio.enabledChains';

export function useEnabledChains(): {
  enabledChains: ChainId[];
  setEnabledChains: (chains: ChainId[]) => void;
  toggleChain: (chain: ChainId) => void;
} {
  const [raw, setRaw] = useMMKVString(STORAGE_KEY);

  const enabledChains = useMemo<ChainId[]>(() => {
    const stored = (() => {
      if (!raw) return DEFAULT_ENABLED_CHAINS;
      try {
        const parsed = JSON.parse(raw) as ChainId[];
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ENABLED_CHAINS;
      } catch {
        return DEFAULT_ENABLED_CHAINS;
      }
    })();
    // BTC-side chains are always implicitly enabled regardless of what the
    // user selected — Bitcoin must not be accidentally hidden.
    return Array.from(new Set([...stored, ...IMPLICIT_ENABLED_CHAINS]));
  }, [raw]);

  const setEnabledChains = useCallback(
    (chains: ChainId[]) => {
      setRaw(JSON.stringify(chains));
    },
    [setRaw],
  );

  const toggleChain = useCallback(
    (chain: ChainId) => {
      const next = enabledChains.includes(chain)
        ? enabledChains.filter((c) => c !== chain)
        : [...enabledChains, chain];
      setEnabledChains(next);
    },
    [enabledChains, setEnabledChains],
  );

  return { enabledChains, setEnabledChains, toggleChain };
}
