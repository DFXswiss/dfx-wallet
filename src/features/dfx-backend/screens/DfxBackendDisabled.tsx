import { Redirect } from 'expo-router';

/**
 * Shared stand-in for every DFX-backend screen when
 * `EXPO_PUBLIC_ENABLE_DFX_BACKEND` is off. Pulls in nothing beyond
 * `expo-router` — no `dfxApi`, no JWT decoder, no host allow-list.
 *
 * Dfx-login, email/user-data, contact, KYC, support and the
 * DFX-wallets management screen all bounce through this stub when the
 * flag is off; the dashboard hides their entry points (settings hub,
 * KYC redirect from Buy/Sell) so deep-link is the only realistic
 * way to land here.
 */
export default function DfxBackendDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
