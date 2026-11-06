import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { classifyScan } from './classifyScan';

type Options = {
  onAddress: (address: string, amount?: string) => void;
  onIban: (iban: string) => void;
  ocpNavigation?: 'push' | 'replace';
};

export function useScanHandler({
  onAddress,
  onIban,
  ocpNavigation = 'push',
}: Options): (data: string) => boolean {
  const router = useRouter();

  return useCallback(
    (data: string) => {
      const result = classifyScan(data);

      switch (result.kind) {
        case 'ocp': {
          const route = {
            pathname: '/(auth)/pay/opencryptopay',
            params: { lnurl: result.lnurl },
          } as const;
          if (ocpNavigation === 'replace') router.replace(route);
          else router.push(route);
          return true;
        }
        case 'address':
          onAddress(result.address, result.amount);
          return true;
        case 'iban':
          onIban(result.iban);
          return true;
        case 'unknown':
          return false;
      }
    },
    [ocpNavigation, onAddress, onIban, router],
  );
}
