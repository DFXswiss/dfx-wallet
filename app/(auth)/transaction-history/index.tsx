import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components';
import { CHAIN_LABELS } from '@/config/portfolio-presentation';
import { dfxTransactionService, type TransactionDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

type FilterType = 'all' | 'Buy' | 'Sell' | 'Swap';

const STATE_COLORS = new Map<string, string>([
  ['Completed', DfxColors.success],
  ['Processing', DfxColors.warning],
  ['AmlCheck', DfxColors.warning],
  ['Created', DfxColors.info],
  ['Failed', DfxColors.error],
  ['Returned', DfxColors.error],
]);

export default function TransactionHistoryScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ asset?: string; network?: string }>();
  const assetFilter = typeof params.asset === 'string' ? params.asset.toUpperCase() : undefined;
  const networkFilter = typeof params.network === 'string' ? params.network : undefined;

  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await dfxTransactionService.getTransactions();
      setTransactions(data);
    } catch {
      // Silently fail — user may not be authenticated yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (assetFilter) {
      list = list.filter(
        (tx) =>
          tx.inputAsset?.toUpperCase() === assetFilter ||
          tx.outputAsset?.toUpperCase() === assetFilter,
      );
    }
    if (filter !== 'all') list = list.filter((tx) => tx.type === filter);
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, assetFilter, filter]);

  const filters: FilterType[] = ['all', 'Buy', 'Sell', 'Swap'];

  const headerTitle = (() => {
    if (assetFilter && networkFilter) {
      return `${assetFilter} · ${CHAIN_LABELS.get(networkFilter) ?? networkFilter}`;
    }
    if (assetFilter) return assetFilter;
    return t('transactions.title');
  })();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AppHeader title={headerTitle} testID="transaction-history" />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {filters.map((f) => (
              <Pressable
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === 'all' ? 'All' : f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={DfxColors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('transactions.noTransactions')}</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.txList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={loadTransactions}
                  tintColor={DfxColors.primary}
                />
              }
            >
              {filtered.map((tx) => (
                <View key={tx.id} style={styles.txItem}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txType}>{tx.type}</Text>
                    <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txAmount}>
                      {tx.type === 'Sell' ? '-' : '+'}
                      {tx.outputAmount} {tx.outputAsset}
                    </Text>
                    <View style={styles.txStatusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: STATE_COLORS.get(tx.state) ?? DfxColors.textTertiary,
                          },
                        ]}
                      />
                      <Text style={styles.txState}>{tx.state}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  safeArea: {
    flex: 1,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DfxColors.surface,
  },
  filterChipActive: {
    backgroundColor: DfxColors.primary,
  },
  filterText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
  },
  filterTextActive: {
    color: DfxColors.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
  scroll: {
    flex: 1,
  },
  txList: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 8,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#0B1426',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  txLeft: {
    gap: 2,
  },
  txType: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  txDate: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  txStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  txState: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
