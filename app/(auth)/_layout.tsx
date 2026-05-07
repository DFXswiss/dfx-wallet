import { Redirect, Stack } from 'expo-router';
import { useDeepLink } from '@/hooks';
import { useAuthStore } from '@/store';
import { DfxColors } from '@/theme';

export default function AuthLayout() {
  useDeepLink();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Hard auth gate: any entry into (auth)/* — including Metro reloads or
  // deep-link restores of dashboard/settings — must pass through PIN or
  // biometric first. `isAuthenticated` is in-memory only, so it resets on
  // every cold start and every JS reload. Hydration happens in the root
  // layout, so by the time this renders the auth state is already loaded.
  if (!isAuthenticated) {
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
