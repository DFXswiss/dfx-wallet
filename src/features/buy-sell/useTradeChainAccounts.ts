import { useAccount } from '@tetherto/wdk-react-native-core';
import { useLdsWallet } from '@/hooks';

/**
 * The WDK accounts + LDS (Lightning) wallet shared by the Buy and Sell
 * linkChain flow. Held at one place because hooks can't be called
 * conditionally — `useLinkChainToDfx` picks the right account based on the
 * chain the caller is attempting to link.
 */
export function useTradeChainAccounts() {
  const btcAccount = useAccount({ network: 'bitcoin', accountIndex: 0 });
  const sparkAccount = useAccount({ network: 'spark', accountIndex: 0 });
  const ethAccount = useAccount({ network: 'ethereum', accountIndex: 0 });
  const lds = useLdsWallet();

  return { btcAccount, sparkAccount, ethAccount, lds };
}

export type TradeChainAccounts = ReturnType<typeof useTradeChainAccounts>;
