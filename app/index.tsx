import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';

export default function Index() {
  // Cloister-Sideload-Build: Home mit „Bezahlen"-Einstieg (umgeht Passkey-Onboarding, das ohne
  // Associated-Domains-Entitlement auf persönlichem Team nicht geht).
  return <Redirect href="/cloister-home" />;

  // eslint-disable-next-line no-unreachable
  const { isOnboarded, isAuthenticated } = useAuthStore();

  // Hydration happens in the root layout, so by the time this renders the
  // auth state is already loaded.
  if (!isOnboarded) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(pin)/verify" />;
  }

  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
