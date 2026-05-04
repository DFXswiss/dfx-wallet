import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

/**
 * Handle deep links: dfxwallet://buy, dfxwallet://receive, etc.
 *
 * Supported paths:
 *   dfxwallet://buy         → Buy screen
 *   dfxwallet://sell        → Sell screen
 *   dfxwallet://send?to=... → Send screen with prefilled recipient
 *   dfxwallet://receive     → Receive screen
 *   dfxwallet://kyc         → KYC screen
 *   dfxwallet://settings    → Settings
 */
export function useDeepLink() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      const path = parsed.path;

      switch (path) {
        case 'buy':
          router.push('/(auth)/buy');
          break;
        case 'sell':
          router.push('/(auth)/sell');
          break;
        case 'send':
          router.push({
            pathname: '/(auth)/send',
            params: parsed.queryParams ?? {},
          } as never);
          break;
        case 'receive':
          router.push('/(auth)/receive');
          break;
        case 'kyc':
          router.push('/(auth)/kyc');
          break;
        case 'settings':
          router.push('/(auth)/(tabs)/settings');
          break;
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Handle initial URL (app opened via deep link)
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, [router]);
}
