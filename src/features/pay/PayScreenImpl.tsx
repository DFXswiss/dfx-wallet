import { useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';

import { ScannerView } from '@/features/scan/ScannerView';
import { useScanHandler } from '@/features/scan/useScanHandler';

export default function PayScreen() {
  const router = useRouter();

  const handleAddress = useCallback(
    (address: string, amount?: string) => {
      router.replace({
        pathname: '/(auth)/send',
        params: { address, ...(amount ? { amount } : {}) },
      });
    },
    [router],
  );

  const handleIban = useCallback(
    (iban: string) => {
      router.replace({ pathname: '/(auth)/send', params: { query: iban } });
    },
    [router],
  );

  const handleScan = useScanHandler({
    onAddress: handleAddress,
    onIban: handleIban,
    ocpNavigation: 'replace',
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ScannerView
        onScan={handleScan}
        onClose={() => router.back()}
        onOpenSettings={() => router.push('/settings')}
      />
    </>
  );
}
