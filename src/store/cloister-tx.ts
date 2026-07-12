import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { TransactionDto } from '@/features/dfx-backend/services';

/**
 * Local-only ledger for Cloister shielded payments.
 *
 * Cloister payments are broadcast by a relayer and never carry the
 * payer's address on-chain, so they cannot come back from the DFX
 * `/v1/transaction/detail` endpoint the way Buy/Sell/Send do. We persist
 * each completed shielded payment here and merge it into the history
 * list so the user still sees a record — tagged `private` with a
 * "Cloister · OpenCryptoPay" badge so its nature is obvious.
 *
 * MMKV (synchronous) keeps the read on first render cheap; the history
 * screen reads `entries` straight from the store with no async gate.
 */
const storage = createMMKV({ id: 'cloister-tx' });
const KEY = 'entries';

export type CloisterTx = TransactionDto & {
  private: true;
  /** Localised hint rendered as the row sub-label, e.g. "Cloister · OpenCryptoPay". */
  badge: string;
  /** Full block-explorer URL for the shielded payment tx. */
  explorerUrl?: string;
};

export type NewCloisterTx = {
  amount: number;
  asset: string;
  /** On-chain tx hash of the relayer broadcast. */
  txId?: string;
  explorerUrl?: string;
  merchant: string;
  network: string;
  badge: string;
  date?: string;
  /** Settlement state. The optimistic flow records 'Processing' on broadcast, then reconciles to
   *  'Completed' (mined) or 'Failed' (reverted) via update(). Defaults to 'Processing'. */
  state?: CloisterTx['state'];
};

function load(): CloisterTx[] {
  try {
    const raw = storage.getString(KEY);
    return raw ? (JSON.parse(raw) as CloisterTx[]) : [];
  } catch {
    return [];
  }
}

type State = {
  entries: CloisterTx[];
  add: (tx: NewCloisterTx) => CloisterTx;
  /** Reconcile an optimistic entry (by id) — e.g. flip 'Pending' → 'Completed'/'Failed'. */
  update: (id: number, patch: Partial<CloisterTx>) => void;
  clear: () => void;
};

export const useCloisterTxStore = create<State>((set, get) => ({
  entries: load(),
  add: (tx) => {
    // Negative ids keep local entries from ever colliding with the
    // positive numeric ids the DFX backend hands out.
    const entry: CloisterTx = {
      id: -Date.now(),
      type: 'Pay',
      state: tx.state ?? 'Processing',
      inputAmount: tx.amount,
      inputAsset: tx.asset,
      outputAmount: tx.amount,
      outputAsset: tx.asset,
      date: tx.date ?? new Date().toISOString(),
      counterparty: tx.merchant,
      network: tx.network,
      private: true,
      badge: tx.badge,
      ...(tx.txId ? { txId: tx.txId } : {}),
      ...(tx.explorerUrl ? { explorerUrl: tx.explorerUrl } : {}),
    };
    const next = [entry, ...get().entries];
    storage.set(KEY, JSON.stringify(next));
    set({ entries: next });
    return entry;
  },
  update: (id, patch) => {
    const next = get().entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    storage.set(KEY, JSON.stringify(next));
    set({ entries: next });
  },
  clear: () => {
    storage.remove(KEY);
    set({ entries: [] });
  },
}));
