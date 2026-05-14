import { Redirect } from 'expo-router';

/**
 * Stand-in for the linked-wallet detail route when
 * `EXPO_PUBLIC_ENABLE_LINKED_WALLETS` is off. Pulls in nothing beyond
 * `expo-router` — no Blockscout/Etherscan/mempool.space fetchers, no
 * CoinGecko price round-trip, no transaction aggregation.
 */
export default function LinkedWalletsDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
