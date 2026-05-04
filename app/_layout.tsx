import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getNetworkConfigs } from '@/config/chains';
import { getTokenConfigs } from '@/config/tokens';
import '@/i18n';

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <WdkAppProvider networkConfigs={getNetworkConfigs()} tokenConfigs={getTokenConfigs()}>
        <StatusBar style="light" />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(pin)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </WdkAppProvider>
    </ErrorBoundary>
  );
}
