import { useCallback, useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import type { ChainId } from '@/config/chains';
import { ALWAYS_ON_CHAINS, DEFAULT_ENABLED_CHAINS, IMPLICIT_ENABLED_CHAINS } from '@/config/tokens';

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
    // ALWAYS_ON + IMPLICIT chains are merged in unconditionally so a user's
    // pre-existing stored selection (from before these chains existed) can't
    // accidentally hide Bitcoin or its companions.
    return Array.from(new Set([...stored, ...ALWAYS_ON_CHAINS, ...IMPLICIT_ENABLED_CHAINS]));
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
