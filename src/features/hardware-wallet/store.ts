import { create } from 'zustand';
import type { HardwareWalletDevice, HardwareWalletStatus } from './services';

type HardwareWalletState = {
  status: HardwareWalletStatus;
  device: HardwareWalletDevice | null;
  address: string | null;
  pairingCode: string | null;
  error: string | null;
  setStatus: (status: HardwareWalletStatus) => void;
  setDevice: (device: HardwareWalletDevice | null) => void;
  setAddress: (address: string) => void;
  setPairingCode: (pairingCode: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useHardwareWalletStore = create<HardwareWalletState>((set) => ({
  status: 'disconnected',
  device: null,
  address: null,
  pairingCode: null,
  error: null,
  setStatus: (status) => set({ status, error: null }),
  setDevice: (device) => set({ device }),
  setAddress: (address) => set({ address }),
  setPairingCode: (pairingCode) => set({ pairingCode }),
  setError: (error) => set({ error, status: 'disconnected' }),
  reset: () =>
    set({ status: 'disconnected', device: null, address: null, pairingCode: null, error: null }),
}));
