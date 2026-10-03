import { Redirect } from 'expo-router';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store';

export default function Index() {
  const { isOnboarded, isAuthenticated, pinHash } = useAuthStore();

  // Hydration happens in the root layout, so by the time this renders the
  // auth state is already loaded.
  if (!isOnboarded) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (FEATURES.PIN && !pinHash) {
    return <Redirect href="/(onboarding)/setup-pin" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(pin)/verify" />;
  }

  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
