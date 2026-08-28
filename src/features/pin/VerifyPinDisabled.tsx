import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/store';

/**
 * Stand-in for the PIN-unlock screen when `EXPO_PUBLIC_ENABLE_PIN` is
 * off. Unlocks the WDK wallet, flips `isAuthenticated` and bounces
 * back to the dashboard.
 *
 * Without this, the auth-layout's "redirect to /(pin)/verify when
 * `isAuthenticated` is false" gate would never resolve: an MVP build
 * has no PIN to enter and no biometric module loaded, so the only way
 * out of the gate is to authenticate unconditionally on mount.
 *
 * The wallet seed is already in secure storage, the WDK worklet
 * unlocks it from there.
 */
export default function VerifyPinDisabled() {
  const router = useRouter();
  const { setAuthenticated } = useAuthStore();
  const { unlock } = useWalletManager();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await unlock('default');
      } catch {
        // The WdkAppProvider exposes its own error UI; if unlock fails
        // we still proceed so the user is not stuck on this stub.
      }
      if (cancelled) return;
      setAuthenticated(true);
      router.replace('/(auth)/(tabs)/dashboard');
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setAuthenticated, unlock]);

  return null;
}
