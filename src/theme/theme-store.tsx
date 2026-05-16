import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { secureStorage } from '@/services/storage';
import { darkColors, lightColors, type ThemeColors } from './colors';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

const THEME_KEY = 'themeMode';

type ThemeState = {
  mode: ThemeMode;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
};

// Light is the production default — first-launch users see the
// mountain-bg light theme regardless of OS appearance. Users who prefer
// dark switch via Settings → Appearance, and that choice is persisted.
const DEFAULT_THEME_MODE: ThemeMode = 'light';

export const useThemeStore = create<ThemeState>((set) => ({
  mode: DEFAULT_THEME_MODE,
  isHydrated: false,
  hydrate: async () => {
    const stored = await secureStorage.get(THEME_KEY);
    // We dropped the "system" appearance option (it was redundant on
    // devices that mirror the app's dark mode anyway). Migrate any
    // previously-persisted "system" value to "dark" so the Appearance
    // cycle in Settings reads as a clean Light ↔ Dark toggle.
    let mode: ThemeMode;
    if (stored === 'light' || stored === 'dark') mode = stored;
    else if (stored === 'system') {
      mode = 'dark';
      await secureStorage.set(THEME_KEY, mode);
    } else mode = DEFAULT_THEME_MODE;
    set({ mode, isHydrated: true });
  },
  setMode: async (mode) => {
    await secureStorage.set(THEME_KEY, mode);
    set({ mode });
  },
}));

/**
 * Resolved theme value propagated via React context. Components read this
 * single value instead of each subscribing to `useThemeStore` +
 * `useColorScheme()` individually — that pattern can produce render-loops
 * during fast-refresh when two hooks fire at slightly different times. The
 * provider lives in app/_layout.tsx and is the single source of truth.
 *
 * Fallback: `lightColors` if the context is read outside the Provider
 * (e.g. inside ErrorBoundary on a render-failure). That keeps error fall-
 * backs visually consistent without coupling them to the live store.
 */
type ThemeContextValue = {
  scheme: ResolvedScheme;
  colors: ThemeColors;
};

const FallbackThemeContextValue: ThemeContextValue = {
  scheme: 'light',
  colors: lightColors,
};

const ThemeContext = createContext<ThemeContextValue>(FallbackThemeContextValue);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    let scheme: ResolvedScheme;
    if (mode === 'light') scheme = 'light';
    else if (mode === 'dark') scheme = 'dark';
    else scheme = systemScheme === 'dark' ? 'dark' : 'light';
    return { scheme, colors: scheme === 'dark' ? darkColors : lightColors };
  }, [mode, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useResolvedScheme(): ResolvedScheme {
  return useContext(ThemeContext).scheme;
}

export function useColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}
