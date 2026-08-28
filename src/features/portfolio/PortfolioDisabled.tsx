import { Redirect } from 'expo-router';

/**
 * Stand-in for portfolio routes (`index`, `[symbol]`, `manage`) when
 * `EXPO_PUBLIC_ENABLE_PORTFOLIO` is off. Pulls in nothing beyond
 * `expo-router` — no `useEnabledChains` MMKV access, no
 * linked-wallets discovery, no chain selector. The dashboard hides
 * the Portfolio pill when the flag is off so the stub is the safety
 * net for deep-links.
 */
export default function PortfolioDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
