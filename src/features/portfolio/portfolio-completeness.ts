import type { IAsset } from '@tetherto/wdk-react-native-core';
import { formatBalance, isFiatPriceAvailable, toNumeric } from '@/config/portfolio-presentation';
import {
  assetIncludedInEvmBalanceQuery,
  assetIncludedInWdkBalanceQuery,
  getAssetMeta,
} from '@/config/tokens';
import type { WalletDiscovery } from '@/features/linked-wallets/useLinkedWalletDiscovery';
import type { BalanceEntry, BalanceMap } from '@/services/balances';
import type { FiatCurrency } from '@/services/pricing-service';

export type PortfolioAssetCompleteness = {
  isQueried: boolean;
  isBalanceComplete: boolean;
  isFiatAvailable: boolean;
  isComplete: boolean;
};

export type PortfolioAssetCompletenessInput = {
  asset: IAsset | undefined;
  balanceEntry: BalanceEntry | undefined;
  balance: number;
  canonicalSymbol: string;
  fiatCurrency: FiatCurrency;
  pricingReady: boolean;
};

export type LocalPortfolioCompletenessInput = {
  assets: readonly IAsset[];
  balances: BalanceMap;
  isLoading: boolean;
  pricingReady: boolean;
  fiatCurrency: FiatCurrency;
};

export type CombinedPortfolioCompletenessInput = {
  localBalancesComplete: boolean;
  linkedProfileIncomplete: boolean;
  linkedWalletAddresses: readonly string[];
  linkedDiscovery: ReadonlyMap<string, WalletDiscovery>;
};

/** Return whether any displayed, queried asset has finished its first balance request. */
export function hasSettledBalanceEntry(assets: readonly IAsset[], balances: BalanceMap): boolean {
  return assets.some((asset) => {
    const meta = getAssetMeta(asset.getId());
    if (!meta || meta.category === 'native') return false;
    if (!assetIncludedInWdkBalanceQuery(asset) && !assetIncludedInEvmBalanceQuery(asset)) {
      return false;
    }

    const status = balances.get(asset.getId())?.status;
    return status !== undefined && status !== 'loading' && status !== 'idle';
  });
}

/**
 * Resolve the balance and price completeness signals for one local asset.
 * Assets excluded from every balance query remain excluded from aggregate
 * totals, so they do not make the aggregate incomplete.
 */
export function getPortfolioAssetCompleteness({
  asset,
  balanceEntry,
  balance,
  canonicalSymbol,
  fiatCurrency,
  pricingReady,
}: PortfolioAssetCompletenessInput): PortfolioAssetCompleteness {
  const isQueried = Boolean(
    asset && (assetIncludedInWdkBalanceQuery(asset) || assetIncludedInEvmBalanceQuery(asset)),
  );
  const isBalanceComplete = isQueried && balanceEntry?.status === 'ok';
  const isFiatAvailable = isFiatPriceAvailable(
    balance,
    canonicalSymbol,
    fiatCurrency,
    pricingReady,
  );

  return {
    isQueried,
    isBalanceComplete,
    isFiatAvailable,
    isComplete: !isQueried || (isBalanceComplete && isFiatAvailable),
  };
}

/** Return whether every queried, non-native local asset has an exact fiat value. */
export function areLocalPortfolioBalancesComplete({
  assets,
  balances,
  isLoading,
  pricingReady,
  fiatCurrency,
}: LocalPortfolioCompletenessInput): boolean {
  if (isLoading) return false;

  return assets.every((asset) => {
    const meta = getAssetMeta(asset.getId());
    if (!meta || meta.category === 'native') return true;

    const balanceEntry = balances.get(asset.getId());
    const balance = toNumeric(formatBalance(balanceEntry?.rawBalance ?? '0', asset.getDecimals()));
    return getPortfolioAssetCompleteness({
      asset,
      balanceEntry,
      balance,
      canonicalSymbol: meta.canonicalSymbol,
      fiatCurrency,
      pricingReady,
    }).isComplete;
  });
}

/** Return whether one selected linked wallet has complete discovery and pricing data. */
export function isLinkedWalletEntryComplete(
  entry: WalletDiscovery | undefined,
): entry is WalletDiscovery {
  return (
    entry?.known === true &&
    entry.complete &&
    entry.assets.every((asset) => asset.fiatValue != null)
  );
}

/** Combine local, DFX-profile and selected linked-wallet completeness. */
export function isCombinedPortfolioComplete({
  localBalancesComplete,
  linkedProfileIncomplete,
  linkedWalletAddresses,
  linkedDiscovery,
}: CombinedPortfolioCompletenessInput): boolean {
  return (
    localBalancesComplete &&
    !linkedProfileIncomplete &&
    linkedWalletAddresses.every((address) =>
      isLinkedWalletEntryComplete(linkedDiscovery.get(address.toLowerCase())),
    )
  );
}
