import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AUTO_LOCK_AFTER_MS } from '@/hooks/useAutoLockConstants';
import { useAuthStore } from '@/store/auth';

export function useAutoLock(): void {
  const backgroundedAt = useRef<number | null>(null);
  const lockSession = useAuthStore((state) => state.lockSession);

  useEffect(() => {
    if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
      backgroundedAt.current = Date.now();
    }

    const handleChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
        return;
      }
      if (
        nextState === 'active' &&
        backgroundedAt.current !== null &&
        Date.now() - backgroundedAt.current >= AUTO_LOCK_AFTER_MS
      ) {
        lockSession();
      }
      if (nextState === 'active') backgroundedAt.current = null;
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [lockSession]);
}
