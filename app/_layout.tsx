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
import { AppAlertProvider } from '@/components/AppAlert';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getWdkConfigs } from '@/config/chains';
import { pricingService } from '@/services/pricing-service';
import { useAuthStore, useWalletStore } from '@/store';
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
  const hydrateWallet = useWalletStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
    void hydrateWallet();
  }, [hydrate, hydrateWallet]);

  // Keep the pricing singleton minute-fresh app-wide. The native EVM
  // Portfolio cards consult `pricingService.getExchangeRate` instead
  // of fetching their own `/simple/price`, so without this timer they
  // showed the same rates from boot until the user pulled to refresh.
  useEffect(() => {
    pricingService.startAutoRefresh(60_000);
    return () => pricingService.stopAutoRefresh();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <WdkAppProvider bundle={{ bundle }} wdkConfigs={getWdkConfigs()}>
          <AppAlertProvider>
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
          </AppAlertProvider>
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
