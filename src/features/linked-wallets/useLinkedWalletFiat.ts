import { useMemo } from 'react';
import { useAccount, type IAsset } from '@tetherto/wdk-react-native-core';
import { computeFiatValue, formatBalance, toNumeric } from '@/config/portfolio-presentation';
import { getAssetMeta } from '@/config/tokens';
import type { ChainId } from '@/config/chains';
import { getRawBalance } from '@/services/balances';
import type { BalanceMap } from '@/services/balances/types';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import type { FiatCurrency } from '@/services/pricing-service';
import { useLinkedWalletBalances } from './useLinkedWalletBalances';

const EVM_CHAINS: ChainId[] = ['ethereum', 'arbitrum', 'polygon', 'base'];

/**
 * Per-linked-wallet fiat resolution that prefers the local-WDK balance
 * cache over a fresh RPC round-trip.
 *
 * The user's primary linked wallets are usually derived from the same seed
 * as the active address (e.g. signed in with BTC, then linked their EVM
 * address — both are reachable from the local WDK accounts). For those we
 * already have fresh balances from `useBalances`; calling JSON-RPC again
 * would just duplicate the work and add a dependency on an external
 * provider being reachable. Wallets whose address doesn't match any local
 * WDK account fall through to {@link useLinkedWalletBalances} so external
 * wallets (linked from another device) still resolve.
 */
export function useLinkedWalletFiat(
  wallets: UserAddressDto[],
  assetConfigs: IAsset[],
  balances: BalanceMap,
  fiatCurrency: FiatCurrency,
  pricingReady: boolean,
): {
  /** Map keyed by lower-cased address. `known: false` flags wallets we
   *  could neither resolve locally nor over RPC (e.g. Lightning-only). */
  data: ReadonlyMap<string, { fiatValue: number; known: boolean }>;
  isLoading: boolean;
} {
  const btcLocal = useAccount({ network: 'bitcoin', accountIndex: 0 }).address ?? null;
  const ethLocal = useAccount({ network: 'ethereum', accountIndex: 0 }).address ?? null;

  const lcBtc = btcLocal?.toLowerCase() ?? null;
  const lcEth = ethLocal?.toLowerCase() ?? null;

  // Wallets that DON'T match any local WDK account; only those need a real
  // network call. Splitting reduces RPC traffic and keeps the headline
  // total responsive when the user's wallets are all on this device.
  const remoteWallets = useMemo(
    () =>
      wallets.filter((w) => {
        const lc = w.address.toLowerCase();
        return lc !== lcBtc && lc !== lcEth;
      }),
    [wallets, lcBtc, lcEth],
  );

  const { data: remoteBalances, isLoading: remoteLoading } = useLinkedWalletBalances(
    remoteWallets,
    fiatCurrency,
    pricingReady,
  );

  const localFiat = useMemo(() => {
    const out = new Map<string, number>();
    for (const wallet of wallets) {
      const lc = wallet.address.toLowerCase();
      let chainsToCount: ChainId[] | null = null;
      if (lc === lcBtc) chainsToCount = ['bitcoin'];
      else if (lc === lcEth) chainsToCount = EVM_CHAINS;
      if (!chainsToCount) continue;

      let sum = 0;
      for (const asset of assetConfigs) {
        const meta = getAssetMeta(asset.getId());
        if (!meta) continue;
        // Linked-wallet cards represent the wallet's total worth, so we
        // include *every* asset on the wallet's chains — native gas
        // tokens (ETH/POL) included. The dashboard's asset-card filter
        // still hides natives separately because it's a per-asset rollup,
        // not a per-wallet sum.
        if (!chainsToCount.includes(meta.network)) continue;
        const raw = getRawBalance(balances, asset.getId());
        const balanceNum = toNumeric(formatBalance(raw, asset.getDecimals()));
        sum += computeFiatValue(balanceNum, meta.canonicalSymbol, fiatCurrency, pricingReady);
      }
      out.set(lc, sum);
    }
    return out;
  }, [wallets, assetConfigs, balances, lcBtc, lcEth, fiatCurrency, pricingReady]);

  const merged = useMemo(() => {
    const out = new Map<string, { fiatValue: number; known: boolean }>();
    for (const wallet of wallets) {
      const lc = wallet.address.toLowerCase();
      const local = localFiat.get(lc);
      if (local !== undefined) {
        // Local match — synchronous, always considered "known" because the
        // balance pipe behind useBalances has its own loading/staleness
        // contract that the screen handles separately.
        out.set(lc, { fiatValue: local, known: true });
        continue;
      }
      const remote = remoteBalances.get(lc);
      out.set(lc, {
        fiatValue: remote?.fiatValue ?? 0,
        known: remote?.known ?? false,
      });
    }
    return out;
  }, [wallets, localFiat, remoteBalances]);

  return { data: merged, isLoading: remoteLoading };
}
