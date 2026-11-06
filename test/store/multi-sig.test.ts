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
import { useMultiSigStore, type MultiSigVault } from '../../src/features/multi-sig/store';

const mockMemory = (mmkv as unknown as { __store: Map<string, string> }).__store;

const SAMPLE_INPUT = {
  name: '2-of-3 family',
  required: 2,
  total: 3,
  cosigners: [{ id: 'c1', address: 'bc1qcosigner1111111111111111111111111111' }],
};

describe('useMultiSigStore', () => {
  beforeEach(() => {
    mockMemory.clear();
    useMultiSigStore.setState({ vaults: [] });
  });

  it('starts with an empty vault list', () => {
    expect(useMultiSigStore.getState().vaults).toEqual([]);
  });

  it('addVault assigns id + createdAt, appends, persists, and returns the vault', () => {
    const before = Date.now();
    const vault = useMultiSigStore.getState().addVault(SAMPLE_INPUT);
    const after = Date.now();

    expect(vault.name).toBe(SAMPLE_INPUT.name);
    expect(vault.required).toBe(2);
    expect(vault.total).toBe(3);
    expect(vault.cosigners).toEqual(SAMPLE_INPUT.cosigners);
    expect(vault.id).toMatch(/^vault-\d+-[a-z0-9]+$/);
    expect(vault.createdAt).toBeGreaterThanOrEqual(before);
    expect(vault.createdAt).toBeLessThanOrEqual(after);

    expect(useMultiSigStore.getState().vaults).toEqual([vault]);
    expect(JSON.parse(mockMemory.get('vaults')!)).toEqual([vault]);
  });

  it('addVault appends onto an existing list', () => {
    const first = useMultiSigStore.getState().addVault(SAMPLE_INPUT);
    const second = useMultiSigStore.getState().addVault({
      ...SAMPLE_INPUT,
      name: '2-of-2 partners',
      required: 2,
      total: 2,
    });

    expect(useMultiSigStore.getState().vaults.map((v) => v.id)).toEqual([first.id, second.id]);
  });

  it('removeVault drops the matching id and persists the remainder', () => {
    const keep = useMultiSigStore.getState().addVault(SAMPLE_INPUT);
    const drop = useMultiSigStore.getState().addVault({
      ...SAMPLE_INPUT,
      name: 'drop-me',
    });

    useMultiSigStore.getState().removeVault(drop.id);

    expect(useMultiSigStore.getState().vaults).toEqual([keep]);
    expect(JSON.parse(mockMemory.get('vaults')!)).toEqual([keep]);
  });

  it('removeVault is a no-op when the id is unknown', () => {
    const vault = useMultiSigStore.getState().addVault(SAMPLE_INPUT);
    useMultiSigStore.getState().removeVault('vault-does-not-exist');
    expect(useMultiSigStore.getState().vaults).toEqual([vault]);
  });
});

describe('useMultiSigStore hydration (loadVaults)', () => {
  const persisted: MultiSigVault = {
    id: 'vault-persisted',
    name: 'cold storage',
    required: 3,
    total: 5,
    cosigners: [],
    createdAt: 1_700_000_000_000,
  };

  afterEach(() => {
    mockMemory.clear();
  });

  it('hydrates a stored vault array on first import', () => {
    mockMemory.set('vaults', JSON.stringify([persisted]));
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useMultiSigStore: store } = require('../../src/features/multi-sig/store');
      expect(store.getState().vaults).toEqual([persisted]);
    });
  });

  it('starts empty when nothing is stored', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useMultiSigStore: store } = require('../../src/features/multi-sig/store');
      expect(store.getState().vaults).toEqual([]);
    });
  });

  it('starts empty when stored JSON is not an array', () => {
    mockMemory.set('vaults', JSON.stringify({ not: 'an-array' }));
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useMultiSigStore: store } = require('../../src/features/multi-sig/store');
      expect(store.getState().vaults).toEqual([]);
    });
  });

  it('starts empty when stored JSON is invalid', () => {
    mockMemory.set('vaults', '{not-json');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useMultiSigStore: store } = require('../../src/features/multi-sig/store');
      expect(store.getState().vaults).toEqual([]);
    });
  });
});
