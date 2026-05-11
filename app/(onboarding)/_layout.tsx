import { Redirect, Stack, useSegments } from 'expo-router';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { useAuthStore } from '@/store';
import { DfxColors } from '@/theme';

export default function OnboardingLayout() {
  const segments = useSegments();
  const { isOnboarded, isAuthenticated } = useAuthStore();
  const { activeWalletId } = useWalletManager();
  const currentScreen = segments.at(-1);
  const isOnboardingRoute = segments[0] === '(onboarding)';

  if (isOnboardingRoute && isOnboarded && currentScreen !== 'legal-disclaimer') {
    return <Redirect href={isAuthenticated ? '/(auth)/(tabs)/dashboard' : '/(pin)/verify'} />;
  }

  if (
    isOnboardingRoute &&
    activeWalletId &&
    currentScreen !== 'setup-pin' &&
    currentScreen !== 'legal-disclaimer'
  ) {
    return <Redirect href="/(onboarding)/setup-pin" />;
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
