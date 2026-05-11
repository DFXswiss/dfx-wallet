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
import { useAuthStore } from '@/store';
import { DfxColors } from '@/theme';
import '@/i18n';

// Silence the WDK / Tether SDK error toasts that pile up in dev when the
// public Ethereum RPC is flaky (timeouts on `eth_getBalance`,
// `getTokenBalances`, etc.). They're surfaced via `handleServiceError` ->
// `console.error` and aren't actionable for the user — the dashboard
// already retries balances on its own.
LogBox.ignoreLogs([
  /\[AccountService\] callAccountMethod/,
  /\[AddressService\] getAddress failed/,
  /Failed to fetch balance for /,
  /could not coalesce error/,
  /bad address checksum/,
  /Network ethereum timed out/,
  // WDK's `useMultiAddressLoader` (consumed transitively by `useBalance`)
  // wraps an UNAVAILABLE / UNAUTHENTICATED Bare-Worklet response as a
  // `console.error` toast at the bottom of the dashboard. The hook
  // already retries the next render cycle once the worklet finishes
  // booting, so the toast is pure noise for the user.
  /useMultiAddressLoader failed/,
]);

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
