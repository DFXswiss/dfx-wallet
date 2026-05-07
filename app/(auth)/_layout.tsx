import { Redirect, Stack } from 'expo-router';
import { useDeepLink } from '@/hooks';
import { useAuthStore } from '@/store';
import { DfxColors } from '@/theme';

export default function AuthLayout() {
  useDeepLink();
  const { isAuthenticated, isHydrated } = useAuthStore();

  // Auth gate: any entry into (auth)/* — including Metro reloads that restore
  // a deep route like dashboard or settings — must pass through PIN/biometric
  // first. `isAuthenticated` is in-memory only, so it resets on every cold
  // start and after every reload.
  if (isHydrated && !isAuthenticated) {
    return <Redirect href="/(pin)/verify" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: DfxColors.background },
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    />
  );
}
