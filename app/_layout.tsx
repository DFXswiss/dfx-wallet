import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WalletProvider } from '@tetherto/wdk-react-native-provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CHAINS_CONFIG } from '@/config/chains';
import { env } from '@/config/env';
import '@/i18n';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <WalletProvider
        config={{
          indexer: {
            apiKey: env.wdkIndexerApiKey,
            url: env.wdkIndexerUrl,
          },
          chains: CHAINS_CONFIG,
          enableCaching: true,
        }}
      >
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(pin)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </WalletProvider>
    </ErrorBoundary>
  );
}
