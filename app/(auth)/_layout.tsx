import { Stack } from 'expo-router';
import { useDeepLink } from '@/hooks';
import { DfxColors } from '@/theme';

export default function AuthLayout() {
  useDeepLink();

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
