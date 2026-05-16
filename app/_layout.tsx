import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { bundle } from '../.wdk';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getWdkConfigs } from '@/config/chains';
import { pricingService } from '@/services/pricing-service';
import { useAuthStore, useWalletStore } from '@/store';
import { ThemeProvider, useColors, useThemeStore } from '@/theme';
import '@/i18n';

LogBox.ignoreLogs([
  /\[AccountService\] callAccountMethod/,
  /\[AddressService\] getAddress failed/,
  /Failed to fetch balance for /,
  /could not coalesce error/,
  /bad address checksum/,
  /Network ethereum timed out/,
  /useMultiAddressLoader failed/,
]);

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

/**
 * Top-level layout. The ThemeProvider sits ABOVE every screen — the
 * actual theme-consuming render lives in `ThemedRoot` below so we never
 * call `useColors()` outside the provider (which would return the fallback
 * light palette instead of the live theme).
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <WdkAppProvider bundle={{ bundle }} wdkConfigs={getWdkConfigs()}>
            <ThemedRoot />
          </WdkAppProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function ThemedRoot() {
  const { isHydrated, hydrate } = useAuthStore();
  const hydrateWallet = useWalletStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const colors = useColors();

  useEffect(() => {
    void hydrate();
    void hydrateWallet();
    void hydrateTheme();
  }, [hydrate, hydrateWallet, hydrateTheme]);

  useEffect(() => {
    pricingService.startAutoRefresh(60_000);
    return () => pricingService.stopAutoRefresh();
  }, []);

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <OfflineBanner />
      {isHydrated ? (
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(pin)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      ) : (
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
