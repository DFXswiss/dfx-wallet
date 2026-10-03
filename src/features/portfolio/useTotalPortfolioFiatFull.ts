import { useEffect, useMemo, useState } from 'react';
import {
  computeFiatValue,
  formatBalance,
  resolveFiatCurrency,
  toNumeric,
  SYMBOL_TO_TICKER,
} from '@/config/portfolio-presentation';
import {
  assetIncludedInEvmBalanceQuery,
  assetIncludedInWdkBalanceQuery,
  getAssetMeta,
  getAssets,
} from '@/config/tokens';
import { getRawBalance, useBalances } from '@/services/balances';
import { dfxUserService } from '@/features/dfx-backend/services';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import { pricingService } from '@/services/pricing-service';
import { useAuthStore, useWalletStore } from '@/store';
import { usePricingSnapshot } from '@/hooks/usePricingSnapshot';
import { useEnabledChains } from './useEnabledChains';
import { useLinkedWalletDiscovery } from '@/features/linked-wallets/useLinkedWalletDiscovery';
import { useLinkedWalletSelection } from '@/features/linked-wallets/useLinkedWalletSelection';

/**
 * Computes the user's total portfolio value in their selected fiat and
 * mirrors it into the wallet store so the dashboard balance stays in sync
 * without each screen having to re-derive it.
 *
 * Sums two ledgers in the same currency:
 *   1. Local WDK asset balances (the dashboard's "own" holdings).
 *   2. Selected DFX-linked wallets — only the ones the user ticked in
 *      Settings → DFX-Wallets, so unticking a wallet visibly drops the
 *      headline total. Active address is excluded from the linked-wallets
 *      sum because its balances already show up via (1).
 */
export function useTotalPortfolioFiat() {
  const { enabledChains } = useEnabledChains();
  const { selectedCurrency } = useWalletStore();
  const setTotalBalanceFiat = useWalletStore((s) => s.setTotalBalanceFiat);
  const isDfxAuthenticated = useAuthStore((s) => s.isDfxAuthenticated);
  const { isSelected } = useLinkedWalletSelection();

  const assetConfigs = useMemo(() => getAssets(enabledChains), [enabledChains]);
  const { data: balances, isLoading: balancesLoading } = useBalances(assetConfigs);
  const pricingRevision = usePricingSnapshot();
  const pricingReady = pricingService.isReady();

  const [linkedAddresses, setLinkedAddresses] = useState<UserAddressDto[]>([]);
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [linkedUserIncomplete, setLinkedUserIncomplete] = useState(false);

  useEffect(() => {
    if (pricingService.isReady()) {
      return;
    }
    void pricingService.initialize().catch(() => undefined);
  }, []);

  // Pull the DFX user once on dashboard mount (and on auth state changes)
  // so the linked-wallets balance hook can fan out without each consumer
  // having to bring its own fetch.
  useEffect(() => {
    if (!isDfxAuthenticated) {
      setLinkedAddresses([]);
      setActiveAddress(null);
      setLinkedUserIncomplete(false);
      return;
    }
    setLinkedUserIncomplete(true);
    let cancelled = false;
    void dfxUserService
      .getUser()
      .then((user) => {
        if (cancelled) return;
        setLinkedAddresses(user.addresses ?? []);
        setActiveAddress(user.activeAddress?.address ?? null);
        setLinkedUserIncomplete(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedUserIncomplete(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDfxAuthenticated]);

  const linkedWallets = useMemo(() => {
    if (!isDfxAuthenticated) return [];
    const lcActive = activeAddress?.toLowerCase() ?? null;
    return linkedAddresses.filter((a) => {
      const lc = a.address.toLowerCase();
      if (lc === lcActive) return false;
      return isSelected(a.address);
    });
  }, [linkedAddresses, activeAddress, isDfxAuthenticated, isSelected]);

  const fiatCurrency = resolveFiatCurrency(selectedCurrency);

  const { data: linkedDiscovery } = useLinkedWalletDiscovery(
    linkedWallets,
    fiatCurrency,
    pricingReady,
  );

  const result = useMemo(() => {
    void pricingRevision;
    let sum = 0;
    let isIncomplete = balancesLoading || linkedUserIncomplete;
    for (const asset of assetConfigs) {
      const meta = getAssetMeta(asset.getId());
      if (!meta || meta.category === 'native') continue;
      const balanceEntry = balances.get(asset.getId());
      const isQueried =
        assetIncludedInWdkBalanceQuery(asset) || assetIncludedInEvmBalanceQuery(asset);
      if (
        isQueried &&
        (!balanceEntry ||
          balanceEntry.status === 'idle' ||
          balanceEntry.status === 'loading' ||
          balanceEntry.status === 'error' ||
          balanceEntry.status === 'stale')
      )
        isIncomplete = true;
      const rawBalance = getRawBalance(balances, asset.getId());
      const balanceNum = toNumeric(formatBalance(rawBalance, asset.getDecimals()));
      const isOwnCurrency = meta.canonicalSymbol === fiatCurrency;
      const ticker = SYMBOL_TO_TICKER.get(meta.canonicalSymbol);
      if (
        balanceNum > 0 &&
        !isOwnCurrency &&
        (!pricingReady || !ticker || pricingService.getExchangeRate(ticker, fiatCurrency) == null)
      ) {
        isIncomplete = true;
      }
      sum += computeFiatValue(balanceNum, meta.canonicalSymbol, fiatCurrency, pricingReady);
    }
    for (const wallet of linkedWallets) {
      const entry = linkedDiscovery.get(wallet.address.toLowerCase());
      if (entry?.known) sum += entry.totalFiat;
      if (!entry?.known || entry.assets.some((asset) => asset.fiatValue == null))
        isIncomplete = true;
    }
    return { totalFiat: sum, isIncomplete };
  }, [
    assetConfigs,
    balances,
    balancesLoading,
    fiatCurrency,
    pricingReady,
    pricingRevision,
    linkedWallets,
    linkedDiscovery,
    linkedUserIncomplete,
  ]);

  useEffect(() => {
    if (result.isIncomplete) return;
    const formatted = Number.isFinite(result.totalFiat)
      ? Math.round(result.totalFiat * 100) / 100
      : 0;
    setTotalBalanceFiat(String(formatted));
  }, [result.isIncomplete, result.totalFiat, setTotalBalanceFiat]);

  return result;
}
