import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DfxColors, Typography } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();

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
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
    </Stack>
  );
}
