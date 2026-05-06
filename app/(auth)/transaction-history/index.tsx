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
import { AppHeader, TransactionRow } from '@/components';
import { CHAIN_LABELS } from '@/config/portfolio-presentation';
import { dfxTransactionService, type TransactionDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

type FilterType = 'all' | 'in' | 'out' | 'pay';

// Tabs map to TX types as follows:
// - "in"  = Buy (DFX on-ramp) + Receive (on-chain)
// - "out" = Sell (DFX off-ramp) + Send (on-chain) + Swap (in-wallet conversion)
// - "pay" = Pay (merchant payment)
const FILTER_TYPES: Record<Exclude<FilterType, 'all'>, readonly TransactionDto['type'][]> = {
  in: ['Buy', 'Receive'],
  out: ['Sell', 'Send', 'Swap'],
  pay: ['Pay'],
};

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
    if (networkFilter) {
      list = list.filter((tx) => !tx.network || tx.network === networkFilter);
    }
    if (filter !== 'all') {
      const allowed =
        filter === 'in' ? FILTER_TYPES.in : filter === 'out' ? FILTER_TYPES.out : FILTER_TYPES.pay;
      list = list.filter((tx) => allowed.includes(tx.type));
    }
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, assetFilter, networkFilter, filter]);

  const filters: readonly { key: FilterType; label: string }[] = [
    { key: 'all', label: t('transactions.filterAll') },
    { key: 'pay', label: t('transactions.filterPay') },
    { key: 'in', label: t('transactions.filterIn') },
    { key: 'out', label: t('transactions.filterOut') },
  ];

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
            <View style={styles.segmentedWrapper}>
              <View style={styles.segmented}>
                {filters.map((f) => {
                  const isActive = filter === f.key;
                  return (
                    <Pressable
                      key={f.key}
                      style={[styles.segment, isActive && styles.segmentActive]}
                      onPress={() => setFilter(f.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        style={[styles.segmentText, isActive && styles.segmentTextActive]}
                        numberOfLines={1}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
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
                      params: { id: String(tx.id), network: tx.network ?? networkFilter ?? '' },
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

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  safeArea: {
    flex: 1,
  },
  segmentedWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: DfxColors.primary,
  },
  segmentText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
    lineHeight: 16,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  segmentTextActive: {
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
