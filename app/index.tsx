import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';

export default function Index() {
  const { isOnboarded, isAuthenticated } = useAuthStore();

  if (!isOnboarded) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(pin)/verify" />;
  }

  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
