import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AUTO_LOCK_AFTER_MS } from '@/hooks/useAutoLockConstants';
import { useAuthStore } from '@/store/auth';

export function useAutoLock(): void {
  const backgroundedAt = useRef<number | null>(null);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);

  useEffect(() => {
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
