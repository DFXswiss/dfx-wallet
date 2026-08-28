import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'multi-sig' });
const VAULTS_KEY = 'vaults';

export type MultiSigCosigner = {
  id: string;
  address: string;
  label?: string;
};

export type MultiSigVault = {
  id: string;
  name: string;
  required: number;
  total: number;
  cosigners: MultiSigCosigner[];
  createdAt: number;
};

type State = {
  vaults: MultiSigVault[];
  addVault: (input: Omit<MultiSigVault, 'id' | 'createdAt'>) => MultiSigVault;
  removeVault: (id: string) => void;
};

const loadVaults = (): MultiSigVault[] => {
  const raw = storage.getString(VAULTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MultiSigVault[]) : [];
  } catch {
    return [];
  }
};

const saveVaults = (vaults: MultiSigVault[]) => {
  storage.set(VAULTS_KEY, JSON.stringify(vaults));
};

export const useMultiSigStore = create<State>((set, get) => ({
  vaults: loadVaults(),
  addVault: (input) => {
    const vault: MultiSigVault = {
      ...input,
      id: `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    const next = [...get().vaults, vault];
    saveVaults(next);
    set({ vaults: next });
    return vault;
  },
  removeVault: (id) => {
    const next = get().vaults.filter((v) => v.id !== id);
    saveVaults(next);
    set({ vaults: next });
  },
}));
