import { Redirect } from 'expo-router';

/**
 * Stand-in for both Buy and Sell routes when
 * `EXPO_PUBLIC_ENABLE_BUY_SELL` is off. Pulls in nothing beyond
 * `expo-router` — no DFX payment service, no asset/fiat resolver, no
 * `useBuyFlow` / `useSellFlow` state machines.
 *
 * The receive and send screens hide the Buy / Sell affordances when
 * the flag is off, so this stub is the safety net for deep-links into
 * `/(auth)/buy` or `/(auth)/sell`.
 */
export default function BuySellDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
