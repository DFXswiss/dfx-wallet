import { useCallback, useEffect, useState } from 'react';
import { secureStorage } from '@/services/storage';

const STORAGE_KEY = 'dfxLinkedWalletNames';

type Listener = (next: ReadonlyMap<string, string>) => void;

let cache: Map<string, string> | null = null;
let hydrating: Promise<Map<string, string>> | null = null;
const listeners = new Set<Listener>();

async function hydrate(): Promise<Map<string, string>> {
  if (cache) return cache;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    const raw = await secureStorage.get(STORAGE_KEY);
    let map: Map<string, string>;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        map = new Map(
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? Object.entries(parsed as Record<string, unknown>)
                .filter(([, v]) => typeof v === 'string' && v.length > 0)
                .map(([k, v]) => [k.toLowerCase(), String(v)] as const)
            : [],
        );
      } catch {
        map = new Map();
      }
    } else {
      map = new Map();
    }
    cache = map;
    return map;
  })();
  try {
    return await hydrating;
  } finally {
    hydrating = null;
  }
}

async function persist(map: Map<string, string>): Promise<void> {
  await secureStorage.set(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
}

function notify(next: Map<string, string>) {
  for (const l of listeners) l(next);
}

/**
 * Custom display names for DFX-linked wallets. Persisted in secureStorage,
 * keyed by lower-cased address (DFX echoes EVM addresses with both
 * checksum and lowercase variants depending on the endpoint).
 *
 * Used in two places: the Settings → DFX-Wallets list (where the user
 * renames a wallet via the pencil button) and the Portfolio's "Linked DFX
 * wallets" rail (where the same name shows on the card). The lookup is
 * pure synchronous after hydration so both screens render the same name
 * the moment a rename lands.
 */
export function useLinkedWalletNames() {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(cache ?? new Map());
  const [isReady, setIsReady] = useState<boolean>(cache !== null);

  useEffect(() => {
    let mounted = true;
    void hydrate().then((map) => {
      if (!mounted) return;
      setNames(new Map(map));
      setIsReady(true);
    });
    const listener: Listener = (next) => setNames(new Map(next));
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  /** Read the current custom name for an address; returns `undefined` when
   *  none was set so the caller can fall back to its default-name policy. */
  const getName = useCallback(
    (address: string): string | undefined => names.get(address.toLowerCase()),
    [names],
  );

  /**
   * Persist a new name for `address`, or remove the override when `name`
   * is empty/whitespace. The empty-string clear path lets a Reset button
   * fall the wallet back to its blockchain-derived default without making
   * the user type the default again.
   */
  const setName = useCallback(async (address: string, name: string): Promise<void> => {
    const map = (await hydrate()) as Map<string, string>;
    const key = address.toLowerCase();
    const trimmed = name.trim();
    if (trimmed.length === 0) map.delete(key);
    else map.set(key, trimmed);
    await persist(map);
    notify(new Map(map));
  }, []);

  return { getName, setName, isReady };
}

/**
 * Pure helper that produces the wallet's display name without touching
 * React state — used by code paths (sort comparators, navigation params)
 * that don't have a hook context. The custom name from the hook overrides
 * this when present.
 */
export function defaultLinkedWalletName(primaryBlockchain: string | null | undefined): string {
  const bc = primaryBlockchain?.trim();
  if (!bc) return 'DFX Wallet';
  return `DFX ${bc}`;
}
