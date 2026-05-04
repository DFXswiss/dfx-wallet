import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet, useWalletManager } from '@tetherto/wdk-react-native-core';
import { ActionBar, AssetListItem, BalanceCard, ScreenContainer } from '@/components';
import { getTokenConfigs } from '@/config/tokens';
import { useDfxAuth } from '@/hooks';
import { useAuthStore, useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

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

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { totalBalanceFiat, selectedCurrency } = useWalletStore();
  const { isDfxAuthenticated } = useAuthStore();
  const { authenticate, isAuthenticating } = useDfxAuth();

  const { wallets, activeWalletId } = useWalletManager();
  const currentWalletId = activeWalletId || wallets[0]?.identifier || 'default';
  const tokenConfigs = useMemo(() => getTokenConfigs(), []);
  const { data: balanceResults } = useBalancesForWallet(0, tokenConfigs, {
    walletId: currentWalletId,
  });

  const assets = useMemo<AggregatedAsset[]>(() => {
    if (!balanceResults) return [];

    return balanceResults
      .filter((r) => r.success && r.balance && r.balance !== '0')
      .map((result) => {
        const networkTokens = tokenConfigs[result.network];
        if (!networkTokens) return null;

        const tokenInfo =
          result.tokenAddress === null
            ? networkTokens.native
            : networkTokens.tokens.find(
                (token) => token.address?.toLowerCase() === result.tokenAddress?.toLowerCase(),
              );
        if (!tokenInfo) return null;

        return {
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          chain: result.network,
          balance: formatBalance(result.balance ?? '0', tokenInfo.decimals),
          balanceFiat: '',
        } satisfies AggregatedAsset;
      })
      .filter((asset): asset is AggregatedAsset => asset !== null);
  }, [balanceResults, tokenConfigs]);

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
              <Text style={styles.seeAll}>History</Text>
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
