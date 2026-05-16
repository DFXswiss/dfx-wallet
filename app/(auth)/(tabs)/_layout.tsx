import { Stack } from 'expo-router';
import { Typography, useColors } from '@/theme';

export const unstable_settings = {
  initialRouteName: 'dashboard',
};

export default function TabsLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { ...Typography.headlineSmall, color: colors.text },
        headerTintColor: colors.primary,
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
