import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { WalletProvider } from '@tetherto/wdk-react-native-provider';
import { CHAINS_CONFIG } from '@/config/chains';
import { env } from '@/config/env';
import '@/i18n';

export default function RootLayout() {
  return (
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
  );
}
