import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DfxColors, Typography } from '@/theme';

// Ensure deep-linking and Metro reloads always land on the dashboard, not on
// whichever child screen happened to be visible when the bundle reloaded.
export const unstable_settings = {
  initialRouteName: 'dashboard',
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const router = useRouter();

  // On every fresh layout mount (cold start, hot reload, deep-link entry),
  // collapse the stack back to the dashboard so the user never wakes up
  // mid-flow on a child screen like Settings.
  useEffect(() => {
    router.replace('/(auth)/(tabs)/dashboard');
  }, [router]);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: DfxColors.background },
        headerStyle: { backgroundColor: DfxColors.surface },
        headerTitleStyle: { ...Typography.headlineSmall, color: DfxColors.text },
        headerTintColor: DfxColors.primary,
        headerShadowVisible: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="dashboard" options={{ headerShown: false, headerBackTitle: ' ' }} />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
    </Stack>
  );
}
