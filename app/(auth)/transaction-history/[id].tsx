import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, Icon } from '@/components';
import { CHAIN_LABELS } from '@/config/portfolio-presentation';
import { dfxTransactionService, type TransactionDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

const STATE_COLORS = new Map<string, string>([
  ['Completed', DfxColors.success],
  ['Processing', DfxColors.warning],
  ['AmlCheck', DfxColors.warning],
  ['Created', DfxColors.info],
  ['Failed', DfxColors.error],
  ['Returned', DfxColors.error],
]);

const EXPLORER_BASE = new Map<string, string>([
  ['ethereum', 'https://etherscan.io/tx/'],
  ['arbitrum', 'https://arbiscan.io/tx/'],
  ['polygon', 'https://polygonscan.com/tx/'],
  ['base', 'https://basescan.org/tx/'],
  ['plasma', 'https://explorer.plasma.to/tx/'],
  ['sepolia', 'https://sepolia.etherscan.io/tx/'],
]);

export default function TransactionDetailScreen() {
  const { t } = useTranslation();
  const { id, network } = useLocalSearchParams<{ id: string; network?: string }>();

  const [tx, setTx] = useState<TransactionDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await dfxTransactionService.getTransactions();
        if (!cancelled) {
          const found = list.find((t) => String(t.id) === String(id));
          setTx(found ?? null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const explorerBase =
    network && typeof network === 'string' ? EXPLORER_BASE.get(network) : undefined;
  const explorerUrl = explorerBase && tx?.txId ? `${explorerBase}${tx.txId}` : undefined;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AppHeader title={t('transactions.detailTitle')} testID="transaction-detail" />

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={DfxColors.primary} />
            </View>
          ) : !tx ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('transactions.notFound')}</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.summaryCard}>
                <Text style={styles.summaryType}>{tx.type}</Text>
                <Text style={styles.summaryAmount}>
                  {tx.type === 'Sell' || tx.type === 'Pay' ? '-' : '+'}
                  {tx.outputAmount} {tx.outputAsset}
                </Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATE_COLORS.get(tx.state) ?? DfxColors.textTertiary },
                    ]}
                  />
                  <Text style={styles.summaryState}>{tx.state}</Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <DetailRow
                  label={t('transactions.date')}
                  value={new Date(tx.date).toLocaleString()}
                />
                <DetailRow
                  label={t('transactions.input')}
                  value={`${tx.inputAmount} ${tx.inputAsset}`}
                />
                <DetailRow
                  label={t('transactions.output')}
                  value={`${tx.outputAmount} ${tx.outputAsset}`}
                />
                {network ? (
                  <DetailRow
                    label={t('transactions.network')}
                    value={CHAIN_LABELS.get(network) ?? network}
                  />
                ) : null}
                {tx.txId ? (
                  <DetailRow
                    label={t('transactions.txHash')}
                    value={`${tx.txId.slice(0, 10)}…${tx.txId.slice(-6)}`}
                    isLast
                  />
                ) : null}
              </View>

              {explorerUrl ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.explorerButton,
                    pressed && styles.explorerPressed,
                  ]}
                  onPress={() => void Linking.openURL(explorerUrl)}
                  testID="tx-explorer-button"
                >
                  <Icon name="document" size={18} color={DfxColors.primary} />
                  <Text style={styles.explorerText}>{t('transactions.viewOnExplorer')}</Text>
                  <Icon name="chevron-right" size={18} color={DfxColors.primary} />
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

function DetailRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowDivider]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  summaryCard: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  summaryType: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: DfxColors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryState: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  detailCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0B1426',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  detailRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DfxColors.border,
  },
  detailLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  detailValue: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    backgroundColor: DfxColors.surface,
    borderRadius: 999,
    shadowColor: '#0B1426',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  explorerPressed: {
    opacity: 0.7,
  },
  explorerText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.primary,
  },
});
