import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components';
import { dfxTransactionService, type TransactionDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

type FilterType = 'all' | 'Buy' | 'Sell' | 'Swap';

const STATE_COLORS: Record<string, string> = {
  Completed: DfxColors.success,
  Processing: DfxColors.warning,
  AmlCheck: DfxColors.warning,
  Created: DfxColors.info,
  Failed: DfxColors.error,
  Returned: DfxColors.error,
};

export default function TransactionHistoryScreen() {
  const router = useRouter();
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
    loadTransactions();
  }, [loadTransactions]);

  const filtered =
    filter === 'all' ? transactions : transactions.filter((tx) => tx.type === filter);

  const filters: FilterType[] = ['all', 'Buy', 'Sell', 'Swap'];

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>Transactions</Text>
          <View style={styles.backButton} />
        </View>

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
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <ScrollView
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
                        { backgroundColor: STATE_COLORS[tx.state] ?? DfxColors.textTertiary },
                      ]}
                    />
                    <Text style={styles.txState}>{tx.state}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  backButton: {
    fontSize: 24,
    color: DfxColors.text,
    width: 32,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
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
  },
  emptyText: {
    ...Typography.bodyLarge,
    color: DfxColors.textTertiary,
  },
  txList: {
    paddingHorizontal: 24,
    gap: 8,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
  },
  txLeft: {
    gap: 4,
  },
  txType: {
    ...Typography.bodyMedium,
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
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
  },
  txStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  txState: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
