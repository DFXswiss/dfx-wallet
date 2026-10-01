import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store/auth';

export const AUTO_LOCK_AFTER_MS = 60_000;

export function useAutoLock(): void {
  const backgroundedAt = useRef<number | null>(null);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);

  useEffect(() => {
    if (!FEATURES.PIN) return;
    const handleChange = (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (
        nextState === 'active' &&
        backgroundedAt.current !== null &&
        Date.now() - backgroundedAt.current > AUTO_LOCK_AFTER_MS
      ) {
        setAuthenticated(false);
      }
      if (nextState === 'active') backgroundedAt.current = null;
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [setAuthenticated]);
}
