import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { bundle } from '../.wdk';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getWdkConfigs } from '@/config/chains';
import '@/i18n';

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <WdkAppProvider bundle={{ bundle }} wdkConfigs={getWdkConfigs()}>
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
