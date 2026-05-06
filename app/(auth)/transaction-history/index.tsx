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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, Icon } from '@/components';
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
  const router = useRouter();
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

          {!assetFilter && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterBar}
              contentContainerStyle={styles.filters}
            >
              {filters.map((f) => (
                <Pressable
                  key={f}
                  style={[styles.filterChip, filter === f && styles.filterChipActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                    {f === 'all' ? t('transactions.filterAll') : f}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

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
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/transaction-history/[id]',
                      params: { id: String(tx.id), network: networkFilter ?? '' },
                    })
                  }
                />
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

type RowProps = { tx: TransactionDto; onPress: () => void };

function TransactionRow({ tx, onPress }: RowProps) {
  const isOutgoing = tx.type === 'Sell';
  const stateColor = STATE_COLORS.get(tx.state) ?? DfxColors.textTertiary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.txItem, pressed && styles.txItemPressed]}
    >
      <View style={[styles.txIcon, { backgroundColor: isOutgoing ? '#FEE2E2' : '#DCFCE7' }]}>
        <Icon
          name={isOutgoing ? 'send' : 'receive'}
          size={18}
          color={isOutgoing ? DfxColors.error : DfxColors.success}
          strokeWidth={2.2}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txType}>{tx.type}</Text>
        <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
      </View>
      <View style={styles.txAmountColumn}>
        <Text
          style={[styles.txAmount, { color: isOutgoing ? DfxColors.error : DfxColors.success }]}
          numberOfLines={1}
        >
          {isOutgoing ? '-' : '+'}
          {tx.outputAmount} {tx.outputAsset}
        </Text>
        <Text style={[styles.txState, { color: stateColor }]} numberOfLines={1}>
          {tx.state}
        </Text>
      </View>
    </Pressable>
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
  filterBar: {
    flexGrow: 0,
    paddingVertical: 12,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
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
    paddingTop: 4,
    paddingBottom: 32,
    gap: 4,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  txItemPressed: {
    opacity: 0.6,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
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
  txAmountColumn: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 110,
  },
  txAmount: {
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
  txState: {
    ...Typography.bodySmall,
    fontWeight: '500',
  },
});
