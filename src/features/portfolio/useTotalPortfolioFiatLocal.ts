import { useEffect, useMemo, useState } from 'react';
import {
  computeFiatValue,
  formatBalance,
  resolveFiatCurrency,
  toNumeric,
} from '@/config/portfolio-presentation';
import { getAssetMeta, getAssets } from '@/config/tokens';
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
export function useTotalPortfolioFiat(): number {
  const { selectedCurrency } = useWalletStore();
  const setTotalBalanceFiat = useWalletStore((s) => s.setTotalBalanceFiat);

  // The full version filters by user-selected `enabledChains`. Without
  // that hook (it lives in the deferred Portfolio feature), the MVP
  // sums across the entire supported chain set — the user has no way
  // to deselect anyway because the manage screen is not reachable.
  const assetConfigs = useMemo(() => getAssets(), []);
  const { data: balances } = useBalances(assetConfigs);
  const [pricingReady, setPricingReady] = useState(pricingService.isReady());

  useEffect(() => {
    if (pricingService.isReady()) {
      setPricingReady(true);
      return;
    }
    void pricingService
      .initialize()
      .then(() => setPricingReady(true))
      .catch(() => setPricingReady(false));
  }, []);

  const fiatCurrency = resolveFiatCurrency(selectedCurrency);

  const totalFiat = useMemo(() => {
    let sum = 0;
    for (const asset of assetConfigs) {
      const meta = getAssetMeta(asset.getId());
      if (!meta || meta.category === 'native') continue;
      const rawBalance = getRawBalance(balances, asset.getId());
      const balanceNum = toNumeric(formatBalance(rawBalance, asset.getDecimals()));
      sum += computeFiatValue(balanceNum, meta.canonicalSymbol, fiatCurrency, pricingReady);
    }
    return sum;
  }, [assetConfigs, balances, fiatCurrency, pricingReady]);

  useEffect(() => {
    const formatted = Number.isFinite(totalFiat) ? Math.round(totalFiat * 100) / 100 : 0;
    setTotalBalanceFiat(String(formatted));
  }, [totalFiat, setTotalBalanceFiat]);

  return totalFiat;
}
