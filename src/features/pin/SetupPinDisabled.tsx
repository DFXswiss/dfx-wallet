import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store';

/**
 * Stand-in for the PIN-setup step when `EXPO_PUBLIC_ENABLE_PIN` is
 * off. Authenticates the in-memory wallet and either opens the legal
 * consent gate or completes onboarding and routes to the dashboard.
 *
 * Without this, the onboarding flow would hand off to a `<Redirect>`
 * back to the welcome screen and the user would loop. The MVP build
 * has no PIN gate so there is nothing to authenticate against — the
 * wallet is unlocked the moment the seed is in WDK.
 *
 * Pulls only the auth store; no `hashPin`, no `secureStore` writes
 * beyond the onboarded flag, no biometric module.
 */
export default function SetupPinDisabled() {
  const router = useRouter();
  const { setOnboarded, setAuthenticated } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!FEATURES.LEGAL) await setOnboarded(true);
      if (cancelled) return;
      setAuthenticated(true);
      router.replace(
        FEATURES.LEGAL ? '/(onboarding)/legal-disclaimer' : '/(auth)/(tabs)/dashboard',
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setOnboarded, setAuthenticated]);

  return null;
}
