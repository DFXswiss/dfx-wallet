import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

type TxStatus = 'completed' | 'pending' | 'failed';
type TxType = 'buy' | 'sell' | 'send' | 'receive';

type Transaction = {
  id: string;
  type: TxType;
  status: TxStatus;
  asset: string;
  chain: string;
  amount: string;
  fiatAmount: string;
  date: string;
};

const TX_TYPE_LABELS: Record<TxType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  send: 'Sent',
  receive: 'Received',
};

const STATUS_COLORS: Record<TxStatus, string> = {
  completed: DfxColors.success,
  pending: DfxColors.warning,
  failed: DfxColors.error,
};

type FilterType = 'all' | TxType;

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');

  // TODO: Fetch from DFX API
  const transactions: Transaction[] = [];

  const filters: FilterType[] = ['all', 'buy', 'sell', 'send', 'receive'];

  const filtered =
    filter === 'all' ? transactions : transactions.filter((tx) => tx.type === filter);

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>Transaction History</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : TX_TYPE_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.txList} showsVerticalScrollIndicator={false}>
            {filtered.map((tx) => (
              <View key={tx.id} style={styles.txItem}>
                <View style={styles.txLeft}>
                  <Text style={styles.txType}>{TX_TYPE_LABELS[tx.type]}</Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txAmount}>
                    {tx.type === 'send' ? '-' : '+'}{tx.amount} {tx.asset}
                  </Text>
                  <View style={styles.txStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[tx.status] }]} />
                    <Text style={styles.txFiat}>{tx.fiatAmount}</Text>
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
  txFiat: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
