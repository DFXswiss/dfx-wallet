import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Deep-link shim for `dfxwallet://cloister-pay?config=…&amount=…`.
 *
 * Expo Router matches an incoming deep link against the file tree before
 * any in-app handler runs, so this top-level route exists purely to catch
 * that URL and forward it — params intact — into the real shielded-payment
 * screen under the authenticated stack.
 */
export default function CloisterPayDeepLink() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(auth)/pay/cloister', params }} />;
}
