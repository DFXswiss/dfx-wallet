import DecimalJS from 'decimal.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet, useWalletManager, useWdkApp } from '@tetherto/wdk-react-native-core';
import { ActionBar, AssetListItem, BalanceCard, ScreenContainer } from '@/components';
import { getAssets } from '@/config/tokens';
import { useDfxAuth } from '@/hooks';
import { AssetTicker, FiatCurrency, pricingService } from '@/services/pricing-service';
import { useAuthStore, useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';
import { debugLog } from '@/utils/debugLog';

type AggregatedAsset = {
  symbol: string;
  name: string;
  chain: string;
  balance: string;
  balanceFiat: string;
};

const formatBalance = (rawBalance: string, decimals: number): string => {
  if (!rawBalance) return '0';
  try {
    const value = BigInt(rawBalance);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const fractional = value % divisor;
    if (fractional === 0n) return whole.toString();
    const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fractionalStr ? `${whole}.${fractionalStr}` : whole.toString();
  } catch {
    return rawBalance;
  }
};

const rawBalanceToAmount = (rawBalance: string, decimals: number): DecimalJS => {
  try {
    return new DecimalJS(rawBalance).div(DecimalJS.pow(10, decimals));
  } catch {
    return new DecimalJS(0);
  }
};

const symbolToTicker = (symbol: string): AssetTicker | null => {
  const s = symbol.toUpperCase();
  if (s === 'USDT') return 'usdt';
  if (s === 'ETH') return 'eth';
  if (s === 'XAUT') return 'xaut';
  if (s === 'MATIC') return 'matic';
  if (s === 'BTC') return 'btc';
  return null;
};

const toFiatCurrency = (code: string): FiatCurrency =>
  code === FiatCurrency.USD ? FiatCurrency.USD : FiatCurrency.CHF;

type PortfolioRow = {
  assetId: string;
  symbol: string;
  name: string;
  chain: string;
  balance: string;
  rawBalance: string;
  decimals: number;
};

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const selectedCurrency = useWalletStore((s) => s.selectedCurrency);
  const totalBalanceFiat = useWalletStore((s) => s.totalBalanceFiat);
  const setTotalBalanceFiat = useWalletStore((s) => s.setTotalBalanceFiat);
  const { isDfxAuthenticated } = useAuthStore();
  const { authenticate, isAuthenticating } = useDfxAuth();

  const assetConfigs = useMemo(() => getAssets(), []);
  const { state: wdkState } = useWdkApp();
  const { activeWalletId, status: walletManagerStatus } = useWalletManager();
  const {
    data: balanceResults,
    isLoading: balancesLoading,
    error: balancesError,
    status: balanceQueryStatus,
    fetchStatus: balanceFetchStatus,
  } = useBalancesForWallet(0, assetConfigs);

  const [fiatByAssetId, setFiatByAssetId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!__DEV__) return;
    const failures = balanceResults?.filter((r) => !r.success).map((r) => ({
      assetId: r.assetId,
      error: r.error,
    }));
    debugLog('Dashboard', 'WDK + balances', {
      wdkStatus: wdkState.status,
      walletManagerStatus,
      activeWalletId: activeWalletId ? `${activeWalletId.slice(0, 8)}…` : null,
      balanceQuery: {
        status: balanceQueryStatus,
        fetchStatus: balanceFetchStatus,
        isLoading: balancesLoading,
        error: balancesError?.message ?? null,
        rowCount: balanceResults?.length,
        failureSample: failures?.slice(0, 8),
      },
    });
  }, [
    wdkState.status,
    walletManagerStatus,
    activeWalletId,
    balanceQueryStatus,
    balanceFetchStatus,
    balancesLoading,
    balancesError?.message,
    balanceResults,
  ]);

  const portfolioRows = useMemo<PortfolioRow[]>(() => {
    if (!balanceResults) return [];

    return balanceResults
      .filter((r) => r.success && r.balance && r.balance !== '0')
      .map((result) => {
        const asset = assetConfigs.find((a) => a.getId() === result.assetId);
        if (!asset) return null;

        return {
          assetId: result.assetId,
          symbol: asset.getSymbol(),
          name: asset.getName(),
          chain: asset.getNetwork(),
          balance: formatBalance(result.balance ?? '0', asset.getDecimals()),
          rawBalance: result.balance ?? '0',
          decimals: asset.getDecimals(),
        } satisfies PortfolioRow;
      })
      .filter((row): row is PortfolioRow => row !== null);
  }, [balanceResults, assetConfigs]);

  useEffect(() => {
    let cancelled = false;

    if (balanceResults === undefined) {
      return () => {
        cancelled = true;
      };
    }

    if (portfolioRows.length === 0) {
      setFiatByAssetId({});
      setTotalBalanceFiat('0.00');
      return () => {
        cancelled = true;
      };
    }

    const fiatCode = toFiatCurrency(selectedCurrency);

    void (async () => {
      const parts = await Promise.all(
        portfolioRows.map(async (row) => {
          const ticker = symbolToTicker(row.symbol);
          if (!ticker) {
            return { assetId: row.assetId, fiat: 0, line: '' as const };
          }
          const amount = rawBalanceToAmount(row.rawBalance, row.decimals);
          const n = amount.toNumber();
          if (!Number.isFinite(n) || n <= 0) {
            return { assetId: row.assetId, fiat: 0, line: '' as const };
          }
          try {
            const fiat = await pricingService.getFiatValue(n, ticker, fiatCode);
            if (!Number.isFinite(fiat)) {
              return { assetId: row.assetId, fiat: 0, line: '' as const };
            }
            const line = `≈ ${fiat.toFixed(2)} ${selectedCurrency}`;
            return { assetId: row.assetId, fiat, line };
          } catch {
            return { assetId: row.assetId, fiat: 0, line: '' as const };
          }
        }),
      );

      if (cancelled) return;

      const nextFiat: Record<string, string> = {};
      let total = new DecimalJS(0);
      for (const p of parts) {
        if (p.line) nextFiat[p.assetId] = p.line;
        total = total.plus(p.fiat);
      }
      setFiatByAssetId(nextFiat);
      setTotalBalanceFiat(total.toDecimalPlaces(2, DecimalJS.ROUND_HALF_UP).toFixed(2));
    })();

    return () => {
      cancelled = true;
    };
  }, [balanceResults, portfolioRows, selectedCurrency, setTotalBalanceFiat]);

  const assets = useMemo<AggregatedAsset[]>(
    () =>
      portfolioRows.map((row) => ({
        symbol: row.symbol,
        name: row.name,
        chain: row.chain,
        balance: row.balance,
        balanceFiat: fiatByAssetId[row.assetId] ?? '',
      })),
    [portfolioRows, fiatByAssetId],
  );

  const hasAttemptedAuthRef = useRef(false);
  useEffect(() => {
    if (isDfxAuthenticated || isAuthenticating || hasAttemptedAuthRef.current) return;
    hasAttemptedAuthRef.current = true;
    authenticate().catch(() => {
      // Auth will be retried when user attempts buy/sell
    });
  }, [isDfxAuthenticated, isAuthenticating, authenticate]);

  const actions = [
    {
      icon: '\u2B06',
      label: t('buy.title'),
      testID: 'dashboard-action-buy',
      onPress: () => router.push('/(auth)/buy'),
    },
    {
      icon: '\u2B07',
      label: t('sell.title'),
      testID: 'dashboard-action-sell',
      onPress: () => router.push('/(auth)/sell'),
    },
    {
      icon: '\u27A1',
      label: t('send.title'),
      testID: 'dashboard-action-send',
      onPress: () => router.push('/(auth)/send'),
    },
    {
      icon: '\u2B05',
      label: t('receive.title'),
      testID: 'dashboard-action-receive',
      onPress: () => router.push('/(auth)/receive'),
    },
  ];

  return (
    <ScreenContainer scrollable>
      <View style={styles.content} testID="dashboard-screen">
        <BalanceCard totalBalance={totalBalanceFiat} currency={selectedCurrency} />
        <ActionBar actions={actions} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.portfolio')}</Text>
            <Pressable
              testID="dashboard-history-button"
              onPress={() => router.push('/(auth)/transaction-history')}
            >
              <Text style={styles.seeAll}>{t('dashboard.activity')}</Text>
            </Pressable>
          </View>

          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>wallet</Text>
              <Text style={styles.emptyTitle}>No assets yet</Text>
              <Text style={styles.emptyDescription}>Buy your first crypto to get started.</Text>
            </View>
          ) : (
            <View style={styles.assetList}>
              {assets.map((asset, i) => (
                <AssetListItem
                  key={`${asset.chain}-${asset.symbol}-${i}`}
                  symbol={asset.symbol}
                  name={asset.name}
                  chain={asset.chain}
                  balance={asset.balance}
                  balanceFiat={asset.balanceFiat}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 16,
    gap: 16,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  seeAll: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
  },
  assetList: {
    gap: 8,
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  emptyDescription: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    textAlign: 'center',
  },
});
