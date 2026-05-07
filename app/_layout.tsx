import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { bundle } from '../.wdk';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getWdkConfigs } from '@/config/chains';
import { useAuthStore } from '@/store';
import { DfxColors } from '@/theme';
import '@/i18n';

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

export default function RootLayout() {
  // Hydrate the auth store at the root so deep-link / Metro-reload entries
  // (which skip app/index.tsx) still get isHydrated set. Without this the
  // (auth) layout's PIN gate can't detect "not authenticated" and would let
  // a restored deep route bypass PIN entirely.
  const { isHydrated, hydrate } = useAuthStore();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <WdkAppProvider bundle={{ bundle }} wdkConfigs={getWdkConfigs()}>
          <StatusBar style="light" />
          <OfflineBanner />
          {isHydrated ? (
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
              }}
            >
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(pin)" />
              <Stack.Screen name="(auth)" />
            </Stack>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={DfxColors.primary} />
            </View>
          )}
        </WdkAppProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: DfxColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
