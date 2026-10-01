import { useEffect } from 'react';

type ScreenCaptureApi = {
  preventScreenCaptureAsync: (key?: string) => Promise<unknown>;
  allowScreenCaptureAsync: (key?: string) => Promise<unknown>;
};

let screenCaptureModule: ScreenCaptureApi | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  screenCaptureModule = require('expo-screen-capture') as ScreenCaptureApi;
} catch {
  screenCaptureModule = null;
}

export function useScreenCaptureProtection(active: boolean, key: string): void {
  useEffect(() => {
    const module = screenCaptureModule;
    if (!active || !module) return;

    void module.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => {
      void module.allowScreenCaptureAsync(key).catch(() => undefined);
    };
  }, [active, key]);
}
