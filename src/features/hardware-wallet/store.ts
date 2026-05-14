import { create } from 'zustand';
import type { HardwareWalletDevice, HardwareWalletStatus } from './services';

type HardwareWalletState = {
  status: HardwareWalletStatus;
  device: HardwareWalletDevice | null;
  address: string | null;
  error: string | null;
  setStatus: (status: HardwareWalletStatus) => void;
  setDevice: (device: HardwareWalletDevice | null) => void;
  setAddress: (address: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useHardwareWalletStore = create<HardwareWalletState>((set) => ({
  status: 'disconnected',
  device: null,
  address: null,
  error: null,
  setStatus: (status) => set({ status, error: null }),
  setDevice: (device) => set({ device }),
  setAddress: (address) => set({ address }),
  setError: (error) => set({ error, status: 'disconnected' }),
  reset: () => set({ status: 'disconnected', device: null, address: null, error: null }),
}));
