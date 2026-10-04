import { useEffect, useRef, useState } from 'react';

type ScreenCaptureApi = {
  preventScreenCaptureAsync: (key?: string) => Promise<unknown>;
  allowScreenCaptureAsync: (key?: string) => Promise<unknown>;
};

export type ScreenCaptureProtectionState = 'pending' | 'active' | 'unavailable';

let screenCaptureModule: ScreenCaptureApi | null = null;
let nextScreenCaptureProtectionId = 1;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  screenCaptureModule = require('expo-screen-capture') as ScreenCaptureApi;
} catch {
  screenCaptureModule = null;
}

export function useScreenCaptureProtection(
  active: boolean,
  key: string,
): ScreenCaptureProtectionState {
  const [state, setState] = useState<ScreenCaptureProtectionState>('pending');
  const instanceId = useRef<number | null>(null);
  if (instanceId.current === null) {
    instanceId.current = nextScreenCaptureProtectionId;
    nextScreenCaptureProtectionId += 1;
  }
  const protectionTag = `${key}:${instanceId.current}`;

  useEffect(() => {
    const module = screenCaptureModule;
    if (!active) {
      setState('pending');
      return;
    }

    // Sensitive content renders after native protection settles. Missing or
    // failing native support is surfaced so callers can render it with a warning.
    if (
      !module ||
      typeof module.preventScreenCaptureAsync !== 'function' ||
      typeof module.allowScreenCaptureAsync !== 'function'
    ) {
      setState('unavailable');
      return;
    }

    let cancelled = false;
    let isProtected = false;
    setState('pending');

    const releaseProtection = () => {
      void Promise.resolve()
        .then(() => module.allowScreenCaptureAsync(protectionTag))
        .catch(() => undefined);
    };

    void Promise.resolve()
      .then(() => module.preventScreenCaptureAsync(protectionTag))
      .then(() => {
        if (cancelled) {
          releaseProtection();
          return;
        }
        isProtected = true;
        setState('active');
      })
      .catch(() => {
        releaseProtection();
        if (!cancelled) setState('unavailable');
      });

    return () => {
      cancelled = true;
      if (isProtected) releaseProtection();
    };
  }, [active, protectionTag]);

  return state;
}
