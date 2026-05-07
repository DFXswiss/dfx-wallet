import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useDeepLink, useDfxAuth } from '@/hooks';
import { dfxApi } from '@/services/dfx';
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

  return <AuthenticatedLayout />;
}

/**
 * Inner layout wired up only after the PIN gate has passed. We register a
 * silent 401-recovery handler on `dfxApi` here so any expired-token call
 * transparently re-signs with the wallet and retries before bubbling up to
 * the user as a "login required" popup. The popup should only ever fire for
 * genuine registration / KYC states or when the wallet itself can't sign.
 */
function AuthenticatedLayout() {
  const { authenticateSilent } = useDfxAuth();

  useEffect(() => {
    dfxApi.setOnUnauthorized(authenticateSilent);
  }, [authenticateSilent]);

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
