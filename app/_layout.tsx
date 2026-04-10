import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '@/i18n';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(pin)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </>
  );
}
