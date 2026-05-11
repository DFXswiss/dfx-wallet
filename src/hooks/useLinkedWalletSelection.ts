import { useCallback, useEffect, useState } from 'react';
import { secureStorage } from '@/services/storage';

const STORAGE_KEY = 'dfxSelectedLinkedWallets';

type Listener = (next: ReadonlySet<string>) => void;

let cache: Set<string> | null = null;
let hydrating: Promise<Set<string>> | null = null;
const listeners = new Set<Listener>();

async function hydrate(): Promise<Set<string>> {
  if (cache) return cache;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    const raw = await secureStorage.get(STORAGE_KEY);
    let set: Set<string>;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        set = new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
      } catch {
        set = new Set<string>();
      }
    } else {
      set = new Set<string>();
    }
    cache = set;
    return set;
  })();
  try {
    return await hydrating;
  } finally {
    hydrating = null;
  }
}

async function persist(set: Set<string>): Promise<void> {
  await secureStorage.set(STORAGE_KEY, JSON.stringify([...set]));
}

function notify(next: Set<string>) {
  for (const l of listeners) l(next);
}

/**
 * Selection state for "DFX-linked wallets that the user wants to surface in
 * the Portfolio". Persisted in secureStorage so the choice survives cold
 * starts; broadcast via an in-memory listener set so all consumers update
 * the moment the user toggles a checkbox in Settings.
 *
 * Addresses are stored lowercased to dodge the EVM mixed-case checksum
 * variants — DFX sometimes returns addresses with `0xAbC…`, sometimes
 * `0xabc…`, but the user's selection should still apply.
 */
export function useLinkedWalletSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(cache ?? new Set());
  const [isReady, setIsReady] = useState<boolean>(cache !== null);

  useEffect(() => {
    let mounted = true;
    void hydrate().then((set) => {
      if (!mounted) return;
      setSelected(new Set(set));
      setIsReady(true);
    });
    const listener: Listener = (next) => setSelected(new Set(next));
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  const isSelected = useCallback(
    (address: string) => selected.has(address.toLowerCase()),
    [selected],
  );

  const toggle = useCallback(async (address: string) => {
    const set = (await hydrate()) as Set<string>;
    const key = address.toLowerCase();
    if (set.has(key)) set.delete(key);
    else set.add(key);
    await persist(set);
    notify(new Set(set));
  }, []);

  return { selected, isSelected, toggle, isReady };
}

/** Imperative read for non-React code (e.g. the buy screen's targetAddress
 *  guard). Caller is responsible for awaiting hydration once at app boot. */
export async function getSelectedLinkedWallets(): Promise<ReadonlySet<string>> {
  return hydrate();
}
