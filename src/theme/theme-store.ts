import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { secureStorage } from '@/services/storage';
import { darkColors, lightColors, type ThemeColors } from './colors';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'themeMode';

type ThemeState = {
  mode: ThemeMode;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  isHydrated: false,
  hydrate: async () => {
    const stored = await secureStorage.get(THEME_KEY);
    const mode: ThemeMode =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    set({ mode, isHydrated: true });
  },
  setMode: async (mode) => {
    await secureStorage.set(THEME_KEY, mode);
    set({ mode });
  },
}));

export function useResolvedScheme(): 'light' | 'dark' {
  const mode = useThemeStore((s) => s.mode);
  // useColorScheme() subscribes to OS appearance changes automatically and
  // is the React Native-recommended way to read the system scheme. Using
  // it directly fixes a stale-cached-value bug we saw with
  // Appearance.getColorScheme() on the iOS Simulator when toggled via
  // `xcrun simctl ui appearance`.
  const systemScheme = useColorScheme();

  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function useColors(): ThemeColors {
  const scheme = useResolvedScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}
