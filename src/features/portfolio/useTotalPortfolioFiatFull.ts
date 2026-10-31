import { useEffect, useMemo } from 'react';
import {
  computeFiatValue,
  formatBalance,
  resolveFiatCurrency,
  toNumeric,
} from '@/config/portfolio-presentation';
import { getAssetMeta, getAssets } from '@/config/tokens';
import {
  areLocalPortfolioBalancesComplete,
  getPortfolioAssetCompleteness,
  isCombinedPortfolioComplete,
} from '@/features/portfolio/portfolio-completeness';
import { useLinkedWalletProfile } from '@/features/portfolio/useLinkedWalletProfile';
import { getRawBalance, useBalances } from '@/services/balances';
import { pricingService } from '@/services/pricing-service';
import { useAuthStore, useWalletStore } from '@/store';
import { usePricingSnapshot } from '@/hooks/usePricingSnapshot';
import { useEnabledChains } from '@/features/portfolio/useEnabledChains';
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
  const {
    linkedAddresses,
    activeAddress,
    isIncomplete: linkedProfileIncomplete,
  } = useLinkedWalletProfile(isDfxAuthenticated);

  useEffect(() => {
    if (pricingService.isReady()) {
      return;
    }
    void pricingService.initialize().catch(() => undefined);
  }, []);

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
    const localBalancesComplete = areLocalPortfolioBalancesComplete({
      assets: assetConfigs,
      balances,
      isLoading: balancesLoading,
      pricingReady,
      fiatCurrency,
    });
    for (const asset of assetConfigs) {
      const meta = getAssetMeta(asset.getId());
      if (!meta || meta.category === 'native') continue;
      const rawBalance = getRawBalance(balances, asset.getId());
      const balanceNum = toNumeric(formatBalance(rawBalance, asset.getDecimals()));
      const completeness = getPortfolioAssetCompleteness({
        asset,
        balanceEntry: balances.get(asset.getId()),
        balance: balanceNum,
        canonicalSymbol: meta.canonicalSymbol,
        fiatCurrency,
        pricingReady,
      });
      if (!completeness.isQueried) continue;
      sum += computeFiatValue(balanceNum, meta.canonicalSymbol, fiatCurrency, pricingReady);
    }
    for (const wallet of linkedWallets) {
      const entry = linkedDiscovery.get(wallet.address.toLowerCase());
      if (entry?.known) sum += entry.totalFiat;
    }
    const isComplete = isCombinedPortfolioComplete({
      localBalancesComplete,
      linkedProfileIncomplete,
      linkedWalletAddresses: linkedWallets.map((wallet) => wallet.address),
      linkedDiscovery,
    });
    return { totalFiat: sum, isIncomplete: !isComplete };
  }, [
    assetConfigs,
    balances,
    balancesLoading,
    fiatCurrency,
    pricingReady,
    pricingRevision,
    linkedWallets,
    linkedDiscovery,
    linkedProfileIncomplete,
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
