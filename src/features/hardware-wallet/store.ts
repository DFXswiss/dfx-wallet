import { create } from 'zustand';
import type { HardwareWalletDevice, HardwareWalletStatus } from './services';

type HardwareWalletState = {
  status: HardwareWalletStatus;
  device: HardwareWalletDevice | null;
  address: string | null;
  error: string | null;
  /** Pairing channel hash to compare against the device screen. Hex-encoded. */
  channelHash: string | null;
  /** Set a non-error status; clears any error from a previous attempt. */
  setStatus: (status: HardwareWalletStatus) => void;
  setDevice: (device: HardwareWalletDevice | null) => void;
  setAddress: (address: string) => void;
  setChannelHash: (channelHash: string | null) => void;
  /**
   * Atomically transition to the error state, preserving the message.
   * Use this instead of `setError` followed by `setStatus('error')`, which
   * previously raced — `setStatus` would wipe the just-set error field.
   */
  setErrorState: (error: string) => void;
  /** Clears the error without changing status. */
  clearError: () => void;
  /**
   * @deprecated Use setErrorState instead. Retained as a one-call-site
   * compatibility shim for HardwareConnectScreenImpl; the screen migrates
   * to setErrorState in the next UI-surface commit. The shim writes both
   * fields atomically (it transitions to status 'error') so even legacy
   * callers no longer hit the wipe-race.
   */
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useHardwareWalletStore = create<HardwareWalletState>((set) => ({
  status: 'disconnected',
  device: null,
  address: null,
  error: null,
  channelHash: null,
  setStatus: (status) => set({ status, error: null }),
  setDevice: (device) => set({ device }),
  setAddress: (address) => set({ address }),
  setChannelHash: (channelHash) => set({ channelHash }),
  setErrorState: (error) => set({ status: 'error', error }),
  clearError: () => set({ error: null }),
  setError: (error) =>
    error === null
      ? set({ error: null })
      : // Treat the legacy two-call sequence as if it were the atomic one.
        set({ status: 'error', error }),
  reset: () =>
    set({
      status: 'disconnected',
      device: null,
      address: null,
      error: null,
      channelHash: null,
    }),
}));
