import { useCallback, useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import type { ChainId } from '@/config/chains';
import { DEFAULT_ENABLED_CHAINS } from '@/config/tokens';

const STORAGE_KEY = 'portfolio.enabledChains';

export function useEnabledChains(): {
  enabledChains: ChainId[];
  setEnabledChains: (chains: ChainId[]) => void;
  toggleChain: (chain: ChainId) => void;
} {
  const [raw, setRaw] = useMMKVString(STORAGE_KEY);

  const enabledChains = useMemo<ChainId[]>(() => {
    if (!raw) return DEFAULT_ENABLED_CHAINS;
    try {
      const parsed = JSON.parse(raw) as ChainId[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ENABLED_CHAINS;
    } catch {
      return DEFAULT_ENABLED_CHAINS;
    }
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
