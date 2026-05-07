import { useEffect, useMemo, useState } from 'react';
import { computeFiatValue, formatBalance, toNumeric } from '@/config/portfolio-presentation';
import { getAssetMeta, getAssets } from '@/config/tokens';
import { getRawBalance, useBalances } from '@/services/balances';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { useEnabledChains } from './useEnabledChains';
import { useWalletStore } from '@/store';

/**
 * Computes the user's total portfolio value in their selected fiat and
 * mirrors it into the wallet store so the dashboard balance stays in sync
 * without each screen having to re-derive it.
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

  const fiatCurrency = selectedCurrency === 'CHF' ? FiatCurrency.CHF : FiatCurrency.USD;

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
