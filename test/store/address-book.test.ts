jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value);
      },
    }),
    __store: store,
  };
});

// eslint-disable-next-line import/first
import * as mmkv from 'react-native-mmkv';
// eslint-disable-next-line import/first
import {
  CONTACT_NAME_MAX_LENGTH,
  findContactByAddress,
  normalizeContactName,
  selectSortedContacts,
  sortContacts,
  useAddressBookStore,
  type Contact,
} from '../../src/store/address-book';

const mockMemory = (mmkv as unknown as { __store: Map<string, string> }).__store;
const STORAGE_KEY = 'addressBook';

const EVM = `0x${'ab12'.repeat(10)}`;
const OTHER_EVM = `0x${'cd34'.repeat(10)}`;
// BIP-173 reference address (whitelisted fixture, see eslint.config.js).
const BTC = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

const persisted = (): Contact[] => JSON.parse(mockMemory.get(STORAGE_KEY) ?? '[]');
const state = () => useAddressBookStore.getState();
const add = (name: string, address = BTC, chain: Contact['chain'] = 'spark') =>
  state().addContact({ name, address, chain });

const makeContact = (overrides: Partial<Contact> & Pick<Contact, 'id' | 'name'>): Contact => ({
  address: BTC,
  chain: 'spark',
  createdAt: 1,
  ...overrides,
});

describe('useAddressBookStore', () => {
  beforeEach(() => {
    mockMemory.clear();
    useAddressBookStore.setState({ contacts: [], hydrated: true });
  });

  describe('addContact', () => {
    it('adds a trimmed contact, persists it and returns it', () => {
      const before = Date.now();
      const result = state().addContact({
        name: '  Anna  ',
        address: `  ${BTC}  `,
        chain: 'spark',
        assetSymbol: 'BTC',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.contact).toMatchObject({
        name: 'Anna',
        address: BTC,
        chain: 'spark',
        assetSymbol: 'BTC',
      });
      expect(result.contact.id).toMatch(/^contact-\d+-[a-z0-9]+$/);
      expect(result.contact.createdAt).toBeGreaterThanOrEqual(before);
      expect(result.contact.lastUsedAt).toBeUndefined();
      expect(state().contacts).toEqual([result.contact]);
      expect(persisted()).toEqual([result.contact]);
    });

    it('leaves assetSymbol out of the record when none is given', () => {
      const result = add('Anna');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect('assetSymbol' in result.contact).toBe(false);
    });

    it('rejects a blank name and a name over the limit', () => {
      expect(add('   ')).toEqual({ ok: false, error: 'invalid-name' });
      expect(add('x'.repeat(CONTACT_NAME_MAX_LENGTH + 1))).toEqual({
        ok: false,
        error: 'invalid-name',
      });
      expect(state().contacts).toEqual([]);
      expect(mockMemory.has(STORAGE_KEY)).toBe(false);
    });

    it('accepts names of exactly 1 and 40 characters', () => {
      expect(add('A').ok).toBe(true);
      expect(add('x'.repeat(CONTACT_NAME_MAX_LENGTH), EVM, 'ethereum').ok).toBe(true);
    });

    it('rejects an implausible address', () => {
      expect(add('Anna', 'too-short')).toEqual({ ok: false, error: 'invalid-address' });
      expect(add('Anna', '0x1234', 'ethereum')).toEqual({ ok: false, error: 'invalid-address' });
      expect(state().contacts).toEqual([]);
    });

    it('updates the contact for the same address on the same chain instead of duplicating', () => {
      const first = add('Anna');
      const second = add('Anna M.');
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;

      expect(state().contacts).toHaveLength(1);
      expect(second.contact.id).toBe(first.contact.id);
      expect(second.contact.createdAt).toBe(first.contact.createdAt);
      expect(state().contacts[0]?.name).toBe('Anna M.');
      expect(persisted()).toHaveLength(1);
    });

    it('matches EVM addresses case-insensitively', () => {
      add('Marco', EVM, 'polygon');
      add('Marco B.', EVM.toUpperCase().replace('0X', '0x'), 'polygon');
      expect(state().contacts).toHaveLength(1);
      expect(state().contacts[0]?.name).toBe('Marco B.');
    });

    it('keeps the same address on another chain as its own contact', () => {
      add('Marco', EVM, 'polygon');
      add('Marco', EVM, 'base');
      expect(state().contacts.map((c) => c.chain)).toEqual(['polygon', 'base']);
    });

    it('keeps the stored asset on update unless a new one is given', () => {
      state().addContact({ name: 'Anna', address: BTC, chain: 'spark', assetSymbol: 'BTC' });
      add('Anna');
      expect(state().contacts[0]?.assetSymbol).toBe('BTC');
      state().addContact({ name: 'Anna', address: BTC, chain: 'spark', assetSymbol: 'CHF' });
      expect(state().contacts[0]?.assetSymbol).toBe('CHF');
    });

    it('keeps lastUsedAt when an existing contact is updated', () => {
      const first = add('Anna');
      if (!first.ok) throw new Error('setup failed');
      state().markUsed(first.contact.id, 5000);
      add('Anna M.');
      expect(state().contacts[0]?.lastUsedAt).toBe(5000);
    });
  });

  describe('renameContact', () => {
    it('renames, trims and persists', () => {
      const added = add('Anna');
      if (!added.ok) throw new Error('setup failed');
      const result = state().renameContact(added.contact.id, '  Anna Meier ');
      expect(result).toEqual({ ok: true, contact: { ...added.contact, name: 'Anna Meier' } });
      expect(persisted()[0]?.name).toBe('Anna Meier');
    });

    it('rejects an invalid name and keeps the old one', () => {
      const added = add('Anna');
      if (!added.ok) throw new Error('setup failed');
      expect(state().renameContact(added.contact.id, ' ')).toEqual({
        ok: false,
        error: 'invalid-name',
      });
      expect(state().contacts[0]?.name).toBe('Anna');
    });

    it('reports an unknown id', () => {
      expect(state().renameContact('nope', 'Anna')).toEqual({ ok: false, error: 'not-found' });
    });
  });

  describe('removeContact', () => {
    it('removes the contact and persists the rest', () => {
      const anna = add('Anna');
      const marco = add('Marco', EVM, 'ethereum');
      if (!anna.ok || !marco.ok) throw new Error('setup failed');
      state().removeContact(anna.contact.id);
      expect(state().contacts).toEqual([marco.contact]);
      expect(persisted()).toEqual([marco.contact]);
    });

    it('is a no-op for an unknown id and does not write', () => {
      add('Anna');
      const before = mockMemory.get(STORAGE_KEY);
      mockMemory.set(STORAGE_KEY, `${before} `);
      state().removeContact('nope');
      expect(mockMemory.get(STORAGE_KEY)).toBe(`${before} `);
      expect(state().contacts).toHaveLength(1);
    });
  });

  describe('markUsed', () => {
    it('stamps lastUsedAt with the given time and persists it', () => {
      const added = add('Anna');
      if (!added.ok) throw new Error('setup failed');
      state().markUsed(added.contact.id, 1234);
      expect(state().contacts[0]?.lastUsedAt).toBe(1234);
      expect(persisted()[0]?.lastUsedAt).toBe(1234);
    });

    it('defaults to the current time', () => {
      const added = add('Anna');
      if (!added.ok) throw new Error('setup failed');
      const before = Date.now();
      state().markUsed(added.contact.id);
      expect(state().contacts[0]?.lastUsedAt).toBeGreaterThanOrEqual(before);
    });

    it('ignores an unknown id', () => {
      add('Anna');
      state().markUsed('nope', 99);
      expect(state().contacts[0]?.lastUsedAt).toBeUndefined();
    });
  });
});

describe('sorting and lookup', () => {
  const anna = makeContact({ id: 'a', name: 'Anna', lastUsedAt: 300 });
  const marco = makeContact({ id: 'm', name: 'Marco', lastUsedAt: 100 });
  const lea = makeContact({ id: 'l', name: 'Lea' });
  const bob = makeContact({ id: 'b', name: 'Bob' });

  it('sorts by lastUsedAt descending, never-used contacts last, then by name', () => {
    expect(sortContacts([bob, marco, lea, anna]).map((c) => c.id)).toEqual(['a', 'm', 'b', 'l']);
  });

  it('does not mutate its input', () => {
    const input = [bob, anna];
    sortContacts(input);
    expect(input.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('selectSortedContacts sorts the state', () => {
    expect(selectSortedContacts({ contacts: [marco, anna] }).map((c) => c.id)).toEqual(['a', 'm']);
  });

  it('findContactByAddress ignores EVM casing', () => {
    const evm = makeContact({ id: 'e', name: 'Eve', address: EVM, chain: 'ethereum' });
    expect(findContactByAddress([anna, evm], EVM.toUpperCase().replace('0X', '0x'))?.id).toBe('e');
    expect(findContactByAddress([anna, evm], OTHER_EVM)).toBeUndefined();
    expect(findContactByAddress([anna, evm], BTC)?.id).toBe('a');
  });

  it('normalizeContactName trims and enforces 1 to 40 characters', () => {
    expect(normalizeContactName('  Anna ')).toBe('Anna');
    expect(normalizeContactName('')).toBeUndefined();
    expect(normalizeContactName('x'.repeat(41))).toBeUndefined();
    expect(normalizeContactName('x'.repeat(40))).toBe('x'.repeat(40));
  });
});

describe('hydration and persistence', () => {
  const stored: Contact = {
    id: 'contact-1',
    name: 'Anna',
    address: BTC,
    chain: 'spark',
    assetSymbol: 'BTC',
    createdAt: 1_700_000_000_000,
    lastUsedAt: 1_700_000_100_000,
  };

  afterEach(() => {
    mockMemory.clear();
  });

  const loadFresh = () => {
    let store!: typeof useAddressBookStore;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      store = require('../../src/store/address-book').useAddressBookStore;
    });
    return store;
  };

  it('does not read storage before hydrate', () => {
    mockMemory.set(STORAGE_KEY, JSON.stringify([stored]));
    const store = loadFresh();
    expect(store.getState().hydrated).toBe(false);
    expect(store.getState().contacts).toEqual([]);
  });

  it('hydrate loads the persisted contacts and marks the store hydrated', () => {
    mockMemory.set(STORAGE_KEY, JSON.stringify([stored]));
    const store = loadFresh();
    store.getState().hydrate();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().contacts).toEqual([stored]);
  });

  it('hydrate runs only once', () => {
    mockMemory.set(STORAGE_KEY, JSON.stringify([stored]));
    const store = loadFresh();
    store.getState().hydrate();
    mockMemory.set(STORAGE_KEY, JSON.stringify([]));
    store.getState().hydrate();
    expect(store.getState().contacts).toEqual([stored]);
  });

  it('survives a restart: contacts added in one session are there in the next', () => {
    const first = loadFresh();
    first.getState().addContact({ name: 'Marco', address: EVM, chain: 'polygon' });
    const second = loadFresh();
    second.getState().hydrate();
    expect(second.getState().contacts.map((c) => c.name)).toEqual(['Marco']);
  });

  it('a mutation before hydrate keeps the persisted contacts', () => {
    mockMemory.set(STORAGE_KEY, JSON.stringify([stored]));
    const store = loadFresh();
    store.getState().addContact({ name: 'Marco', address: EVM, chain: 'polygon' });
    expect(store.getState().contacts.map((c) => c.name)).toEqual(['Anna', 'Marco']);
    expect(JSON.parse(mockMemory.get(STORAGE_KEY)!)).toHaveLength(2);
  });

  it('starts empty when nothing is stored', () => {
    const store = loadFresh();
    store.getState().hydrate();
    expect(store.getState().contacts).toEqual([]);
    expect(store.getState().hydrated).toBe(true);
  });

  it('starts empty when the stored JSON is invalid or not an array', () => {
    mockMemory.set(STORAGE_KEY, '{not-json');
    const broken = loadFresh();
    broken.getState().hydrate();
    expect(broken.getState().contacts).toEqual([]);

    mockMemory.set(STORAGE_KEY, JSON.stringify({ not: 'an-array' }));
    const object = loadFresh();
    object.getState().hydrate();
    expect(object.getState().contacts).toEqual([]);
  });

  it('drops stored entries that are not well-formed contacts', () => {
    mockMemory.set(
      STORAGE_KEY,
      JSON.stringify([
        stored,
        null,
        'text',
        { id: 'x' },
        { ...stored, id: 'bad-time', createdAt: 'yesterday' },
        { ...stored, id: 'bad-asset', assetSymbol: 5 },
        { ...stored, id: 'bad-used', lastUsedAt: 'never' },
      ]),
    );
    const store = loadFresh();
    store.getState().hydrate();
    expect(store.getState().contacts).toEqual([stored]);
  });
});
