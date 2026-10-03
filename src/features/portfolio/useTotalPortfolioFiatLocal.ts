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
} from '@/features/portfolio/portfolio-completeness';
import { usePricingSnapshot } from '@/hooks/usePricingSnapshot';
import { getRawBalance, useBalances } from '@/services/balances';
import { pricingService } from '@/services/pricing-service';
import { useWalletStore } from '@/store';

/**
 * MVP variant of `useTotalPortfolioFiat`. Sums only the **local** WDK
 * asset balances against the live pricing service — no DFX-linked
 * wallets, no enabled-chains filter, no DFX user lookup. Used when
 * `FEATURES.PORTFOLIO`, `FEATURES.LINKED_WALLETS` or
 * `FEATURES.DFX_BACKEND` are off, so the dashboard's headline balance
 * still renders something meaningful without pulling deferred code
 * (DFX user service, linked-wallets discovery) into the MVP bundle.
 *
 * Pricing initialization is identical to the full version so the same
 * `useEffect` lifecycle drives the "ready → set total" transition.
 */
export type PortfolioFiatResult = { totalFiat: number; isIncomplete: boolean };

export function useTotalPortfolioFiat(): PortfolioFiatResult {
  const { selectedCurrency } = useWalletStore();
  const setTotalBalanceFiat = useWalletStore((s) => s.setTotalBalanceFiat);

  // The full version filters by user-selected `enabledChains`. Without
  // that hook (it lives in the deferred Portfolio feature), the MVP
  // sums across the entire supported chain set — the user has no way
  // to deselect anyway because the manage screen is not reachable.
  const assetConfigs = useMemo(() => getAssets(), []);
  const { data: balances, isLoading: balancesLoading } = useBalances(assetConfigs);
  const pricingRevision = usePricingSnapshot();
  const pricingReady = pricingService.isReady();

  useEffect(() => {
    if (pricingService.isReady()) {
      return;
    }
    void pricingService.initialize().catch(() => undefined);
  }, []);

  const fiatCurrency = resolveFiatCurrency(selectedCurrency);

  const result = useMemo<PortfolioFiatResult>(() => {
    void pricingRevision;
    let sum = 0;
    const isComplete = areLocalPortfolioBalancesComplete({
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
    return { totalFiat: sum, isIncomplete: !isComplete };
  }, [assetConfigs, balances, balancesLoading, fiatCurrency, pricingReady, pricingRevision]);

  useEffect(() => {
    if (result.isIncomplete) return;
    const formatted = Number.isFinite(result.totalFiat)
      ? Math.round(result.totalFiat * 100) / 100
      : 0;
    setTotalBalanceFiat(String(formatted));
  }, [result.isIncomplete, result.totalFiat, setTotalBalanceFiat]);

  return result;
}
