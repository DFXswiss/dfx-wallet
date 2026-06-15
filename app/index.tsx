import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setOnboarded = useAuthStore((s) => s.setOnboarded);

  // Cloister sideload-build entry: skip the passkey onboarding + PIN gate
  // (passkeys need the Associated-Domains entitlement, which a personal
  // signing team can't issue) and drop the user straight onto the real DFX
  // dashboard, where the real Pay flow with the Silent/Normal toggle lives.
  // The WDK provider degrades gracefully without a provisioned seed, so the
  // dashboard renders with a zero balance and Pay/History stay fully usable.
  useEffect(() => {
    void setOnboarded(true);
    setAuthenticated(true);
  }, [setOnboarded, setAuthenticated]);

  if (!isAuthenticated) return null;
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
