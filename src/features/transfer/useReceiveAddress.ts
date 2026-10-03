import { useAccount } from '@tetherto/wdk-react-native-core';

import type { ChainId } from '@/config/chains';
import { useLdsWallet } from '@/hooks';

export function useReceiveAddress(chain: ChainId): string {
  const { address: derivedAddress } = useAccount({ network: chain, accountIndex: 0 });
  const lds = useLdsWallet();

  return chain === 'bitcoin-taproot' ? (lds.user?.lightning.address ?? '') : (derivedAddress ?? '');
}
