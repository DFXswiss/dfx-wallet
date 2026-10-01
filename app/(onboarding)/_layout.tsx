import { Redirect, Stack, useSegments } from 'expo-router';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/store';
import { useColors } from '@/theme';

export default function OnboardingLayout() {
  const colors = useColors();
  const segments = useSegments();
  const { isOnboarded, isAuthenticated, pinHash } = useAuthStore();
  const { activeWalletId } = useWalletManager();
  const currentScreen = segments.at(-1);
  const isOnboardingRoute = segments[0] === '(onboarding)';
  const isUnauthenticatedRecovery = currentScreen === 'restore-wallet' && !isAuthenticated;

  if (isOnboardingRoute && isOnboarded && !isUnauthenticatedRecovery) {
    return <Redirect href={isAuthenticated ? '/(auth)/(tabs)/dashboard' : '/(pin)/verify'} />;
  }

  if (currentScreen === 'legal-disclaimer') {
    const canAcceptLegal = !isOnboarded && isAuthenticated && !!activeWalletId;
    if (!canAcceptLegal) {
      if (!activeWalletId) return <Redirect href="/(onboarding)/welcome" />;
      return <Redirect href={pinHash ? '/(pin)/verify' : '/(onboarding)/setup-pin'} />;
    }
  }

  if (activeWalletId && pinHash && !isAuthenticated && !isUnauthenticatedRecovery) {
    return <Redirect href="/(pin)/verify" />;
  }

  if (
    isOnboardingRoute &&
    activeWalletId &&
    currentScreen !== 'setup-pin' &&
    currentScreen !== 'legal-disclaimer' &&
    !isUnauthenticatedRecovery
  ) {
    return <Redirect href="/(onboarding)/setup-pin" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    />
  );
}
