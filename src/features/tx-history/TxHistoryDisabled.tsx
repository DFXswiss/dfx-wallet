import { Redirect } from 'expo-router';

/**
 * Stand-in for transaction-history routes when
 * `EXPO_PUBLIC_ENABLE_TX_HISTORY` is off. Pulls in nothing beyond
 * `expo-router` — no DFX transaction service, no FlatList of typed
 * transactions, no per-tx detail navigation. The dashboard hides the
 * "Transactions" affordance when the flag is off, so this stub is the
 * safety net for deep-links into `/(auth)/transaction-history`.
 */
export default function TxHistoryDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
