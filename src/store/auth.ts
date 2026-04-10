import { create } from 'zustand';

type AuthState = {
  isOnboarded: boolean;
  isAuthenticated: boolean;
  pin: string | null;
  setOnboarded: (value: boolean) => void;
  setAuthenticated: (value: boolean) => void;
  setPin: (pin: string) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isOnboarded: false,
  isAuthenticated: false,
  pin: null,
  setOnboarded: (value) => set({ isOnboarded: value }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setPin: (pin) => set({ pin }),
  reset: () => set({ isOnboarded: false, isAuthenticated: false, pin: null }),
}));
