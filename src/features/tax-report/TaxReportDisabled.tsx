import { Redirect } from 'expo-router';

/**
 * Stand-in for the tax-report screen when `EXPO_PUBLIC_ENABLE_TAX_REPORT`
 * is off. Pulls in nothing beyond `expo-router` — no `expo-file-system`,
 * no `expo-sharing`, no DFX transaction service. The disabled-path's
 * surface stays tiny so a compromised CSV export pipeline can never
 * reach an MVP build.
 */
export default function TaxReportDisabled() {
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
