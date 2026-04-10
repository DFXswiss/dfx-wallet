import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ActionBar, AssetListItem, BalanceCard, ScreenContainer } from '@/components';
import { useDfxAuth } from '@/hooks';
import { useAuthStore, useWalletStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { totalBalanceFiat, selectedCurrency, assets } = useWalletStore();
  const { balances, isLoading: wdkLoading, refreshWalletBalance } = useWallet();
  const { isDfxAuthenticated } = useAuthStore();
  const { authenticate, isAuthenticating } = useDfxAuth();

  // Auto-authenticate with DFX API on first dashboard visit
  useEffect(() => {
    if (!isDfxAuthenticated && !isAuthenticating) {
      authenticate().catch(() => {
        // Auth will be retried when user attempts buy/sell
      });
    }
  }, [isDfxAuthenticated, isAuthenticating, authenticate]);

  const actions = [
    {
      icon: '\u2B06',
      label: t('buy.title'),
      onPress: () => router.push('/(auth)/buy'),
    },
    {
      icon: '\u2B07',
      label: t('sell.title'),
      onPress: () => router.push('/(auth)/sell'),
    },
    {
      icon: '\u27A1',
      label: t('send.title'),
      onPress: () => router.push('/(auth)/send'),
    },
    {
      icon: '\u2B05',
      label: t('receive.title'),
      onPress: () => router.push('/(auth)/receive'),
    },
  ];

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <BalanceCard totalBalance={totalBalanceFiat} currency={selectedCurrency} />
        <ActionBar actions={actions} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.portfolio')}</Text>
            <Pressable onPress={() => router.push('/(auth)/transaction-history')}>
              <Text style={styles.seeAll}>History</Text>
            </Pressable>
          </View>

          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>wallet</Text>
              <Text style={styles.emptyTitle}>No assets yet</Text>
              <Text style={styles.emptyDescription}>
                Buy your first crypto to get started.
              </Text>
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
