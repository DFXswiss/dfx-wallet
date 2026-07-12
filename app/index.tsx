import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';

// Cloister sideload-build entry only: skip the passkey onboarding + PIN gate (passkeys need
// the Associated-Domains entitlement, which a personal signing team can't issue) and drop
// straight onto the dashboard. Gated behind an explicit flag so it is provably OFF in normal
// / production / CI builds, where the real onboarding + PIN routing runs.
const SIDELOAD = process.env.EXPO_PUBLIC_CLOISTER_SIDELOAD === '1';

export default function Index() {
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setOnboarded = useAuthStore((s) => s.setOnboarded);

  useEffect(() => {
    if (!SIDELOAD) return;
    void setOnboarded(true);
    setAuthenticated(true);
  }, [setOnboarded, setAuthenticated]);

  if (SIDELOAD) {
    return isAuthenticated ? <Redirect href="/(auth)/(tabs)/dashboard" /> : null;
  }

  // Normal routing (hydration runs in the root layout, so auth state is loaded here).
  if (!isOnboarded) return <Redirect href="/(onboarding)/welcome" />;
  if (!isAuthenticated) return <Redirect href="/(pin)/verify" />;
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
