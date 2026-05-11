import { useCallback, useEffect, useState } from 'react';
import { secureStorage } from '@/services/storage';

/**
 * Hidden-set storage. The previous "explicitly included" model
 * (`dfxSelectedLinkedWallets`) defaulted to "nothing shown" — fine while
 * the feature was new but it meant that wiping the keychain (re-install,
 * factory reset, Maestro `clearKeychain`) made a user's linked wallets
 * disappear from the Portfolio until they re-toggled each checkbox.
 *
 * Flipping to a hidden-set model preserves user intent across resets:
 * an empty (or missing) storage value means "everything visible", which
 * matches what a returning user reasonably expects to see after their
 * device-side state has been cleared. Toggling a checkbox off persists
 * an explicit exclusion; toggling back on removes it.
 *
 * Using a fresh key here ({@link STORAGE_KEY}) so we never accidentally
 * interpret a pre-existing inclusion set with the new semantics — the
 * previous values would invert the user's intent.
 */
const STORAGE_KEY = 'dfxHiddenLinkedWallets';

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
 * Visibility state for "DFX-linked wallets in the Portfolio rail".
 *
 * Default: every linked wallet shows up. Tapping the checkbox in
 * Settings → DFX-Wallets persists an exclusion entry so that wallet
 * hides from the Portfolio until the user reticks it. State survives
 * cold starts via secureStorage; a listener set keeps every consumer
 * (Settings + Portfolio + dashboard total) in sync the moment a toggle
 * lands.
 *
 * Addresses are stored lowercased to dodge the EVM mixed-case checksum
 * variants — DFX sometimes returns `0xAbC…`, sometimes `0xabc…`, but
 * the user's exclusion should still apply.
 */
export function useLinkedWalletSelection() {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(cache ?? new Set());
  const [isReady, setIsReady] = useState<boolean>(cache !== null);

  useEffect(() => {
    let mounted = true;
    void hydrate().then((set) => {
      if (!mounted) return;
      setHidden(new Set(set));
      setIsReady(true);
    });
    const listener: Listener = (next) => setHidden(new Set(next));
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  /** True when the wallet should surface in the Portfolio rail. With the
   *  hidden-set model: "visible" is the default, only explicit excludes
   *  flip it off. */
  const isSelected = useCallback((address: string) => !hidden.has(address.toLowerCase()), [hidden]);

  const toggle = useCallback(async (address: string) => {
    const set = (await hydrate()) as Set<string>;
    const key = address.toLowerCase();
    if (set.has(key)) set.delete(key);
    else set.add(key);
    await persist(set);
    notify(new Set(set));
  }, []);

  return { hidden, isSelected, toggle, isReady };
}

/** Imperative read for non-React code (e.g. the buy screen's targetAddress
 *  guard). Returns the set of *hidden* addresses; caller inverts as needed.
 *  Caller is responsible for awaiting hydration once at app boot. */
export async function getHiddenLinkedWallets(): Promise<ReadonlySet<string>> {
  return hydrate();
}
