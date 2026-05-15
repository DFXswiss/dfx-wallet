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
import { useEnabledChains } from './useEnabledChains';

/**
 * Computes the available balance from the wallet's internal WDK assets only.
 * DFX-linked wallets are intentionally excluded from this headline because
 * they are external balances surfaced in their own Portfolio section.
 */
export function useTotalPortfolioFiat() {
  const { enabledChains } = useEnabledChains();
  const { selectedCurrency } = useWalletStore();
  const setTotalBalanceFiat = useWalletStore((s) => s.setTotalBalanceFiat);

  const assetConfigs = useMemo(() => getAssets(enabledChains), [enabledChains]);
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
