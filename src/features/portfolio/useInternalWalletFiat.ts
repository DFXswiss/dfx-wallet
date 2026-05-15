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
 * Fiat value available inside this app's own wallets. Used by Pay, where the
 * user needs to know what can actually be spent from the device right now.
 * DFX-linked external wallets are intentionally excluded.
 */
export function useInternalWalletFiat(): number {
  const { enabledChains } = useEnabledChains();
  const { selectedCurrency } = useWalletStore();

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

  return useMemo(() => {
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
}
