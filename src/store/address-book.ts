import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { ChainId } from '@/config/chains';
import { addressesEqual, isPlausibleAddress } from '@/features/transfer/address';
import { StorageKeys } from '@/services/storage';

/**
 * Local address book for the send flow. Contacts live only on this device
 * (MMKV): nothing is synced to a server and no secret is stored — a contact
 * is a name plus a public address. The MMKV instance is opened on first use,
 * so importing the store (it is part of the `@/store` barrel) never touches
 * native storage.
 */

export const CONTACT_NAME_MAX_LENGTH = 40;

export type Contact = {
  id: string;
  name: string;
  address: string;
  chain: ChainId;
  assetSymbol?: string;
  createdAt: number;
  lastUsedAt?: number;
};

export type ContactInput = {
  name: string;
  address: string;
  chain: ChainId;
  assetSymbol?: string;
};

export type ContactError = 'invalid-name' | 'invalid-address' | 'not-found';
export type ContactResult = { ok: true; contact: Contact } | { ok: false; error: ContactError };

type AddressBookState = {
  contacts: Contact[];
  hydrated: boolean;
  /** Load the persisted contacts once; later calls are no-ops. */
  hydrate: () => void;
  /** Add a contact; the same address on the same chain updates the existing entry instead. */
  addContact: (input: ContactInput) => ContactResult;
  renameContact: (id: string, name: string) => ContactResult;
  removeContact: (id: string) => void;
  markUsed: (id: string, now?: number) => void;
};

type AddressBookStorage = ReturnType<typeof createMMKV>;

let storage: AddressBookStorage | undefined;

const getStorage = (): AddressBookStorage => {
  if (!storage) storage = createMMKV({ id: 'address-book' });
  return storage;
};

const isContact = (value: unknown): value is Contact => {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c['id'] === 'string' &&
    typeof c['name'] === 'string' &&
    typeof c['address'] === 'string' &&
    typeof c['chain'] === 'string' &&
    typeof c['createdAt'] === 'number' &&
    (c['assetSymbol'] === undefined || typeof c['assetSymbol'] === 'string') &&
    (c['lastUsedAt'] === undefined || typeof c['lastUsedAt'] === 'number')
  );
};

const loadContacts = (): Contact[] => {
  const raw = getStorage().getString(StorageKeys.ADDRESS_BOOK);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isContact) : [];
  } catch {
    return [];
  }
};

const saveContacts = (contacts: Contact[]) => {
  getStorage().set(StorageKeys.ADDRESS_BOOK, JSON.stringify(contacts));
};

/** Trimmed name, or `undefined` when it is empty or longer than the limit. */
export const normalizeContactName = (name: string): string | undefined => {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= CONTACT_NAME_MAX_LENGTH ? trimmed : undefined;
};

/** Most recently used first (never-used contacts last), ties broken by name. */
export const sortContacts = (contacts: readonly Contact[]): Contact[] =>
  [...contacts].sort((a, b) => {
    const byUse = (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
    return byUse !== 0 ? byUse : a.name.localeCompare(b.name);
  });

export const selectSortedContacts = (state: { contacts: readonly Contact[] }): Contact[] =>
  sortContacts(state.contacts);

export const findContactByAddress = (
  contacts: readonly Contact[],
  address: string,
): Contact | undefined => contacts.find((c) => addressesEqual(c.address, address));

export const useAddressBookStore = create<AddressBookState>((set, get) => {
  const ensureHydrated = () => {
    if (!get().hydrated) get().hydrate();
  };

  const commit = (contacts: Contact[]) => {
    saveContacts(contacts);
    set({ contacts });
  };

  return {
    contacts: [],
    hydrated: false,

    hydrate: () => {
      if (get().hydrated) return;
      set({ contacts: loadContacts(), hydrated: true });
    },

    addContact: (input) => {
      ensureHydrated();
      const name = normalizeContactName(input.name);
      if (!name) return { ok: false, error: 'invalid-name' };
      const address = input.address.trim();
      if (!isPlausibleAddress(address)) return { ok: false, error: 'invalid-address' };

      const contacts = get().contacts;
      const existing = contacts.find(
        (c) => c.chain === input.chain && addressesEqual(c.address, address),
      );
      if (existing) {
        const updated: Contact = {
          ...existing,
          name,
          ...(input.assetSymbol ? { assetSymbol: input.assetSymbol } : {}),
        };
        commit(contacts.map((c) => (c.id === existing.id ? updated : c)));
        return { ok: true, contact: updated };
      }

      const contact: Contact = {
        id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        address,
        chain: input.chain,
        ...(input.assetSymbol ? { assetSymbol: input.assetSymbol } : {}),
        createdAt: Date.now(),
      };
      commit([...contacts, contact]);
      return { ok: true, contact };
    },

    renameContact: (id, name) => {
      ensureHydrated();
      const trimmed = normalizeContactName(name);
      if (!trimmed) return { ok: false, error: 'invalid-name' };
      const existing = get().contacts.find((c) => c.id === id);
      if (!existing) return { ok: false, error: 'not-found' };
      const updated: Contact = { ...existing, name: trimmed };
      commit(get().contacts.map((c) => (c.id === id ? updated : c)));
      return { ok: true, contact: updated };
    },

    removeContact: (id) => {
      ensureHydrated();
      const contacts = get().contacts;
      const next = contacts.filter((c) => c.id !== id);
      if (next.length === contacts.length) return;
      commit(next);
    },

    markUsed: (id, now = Date.now()) => {
      ensureHydrated();
      const contacts = get().contacts;
      if (!contacts.some((c) => c.id === id)) return;
      commit(contacts.map((c) => (c.id === id ? { ...c, lastUsedAt: now } : c)));
    },
  };
});
