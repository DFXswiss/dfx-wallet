import { Stack } from 'expo-router';
import { Typography, useColors } from '@/theme';

// Ensure deep-linking and Metro reloads always land on the dashboard, not on
// whichever child screen happened to be visible when the bundle reloaded.
// The PIN verify flow already replaces to /dashboard on success, so there's
// no need for a second redirect here.
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
