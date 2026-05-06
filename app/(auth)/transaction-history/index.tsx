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
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components';
import { type OnchainTransferListItem, useOnchainTokenTransfers } from '@/hooks';
import { dfxTransactionService, type TransactionDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';
import { debugLog } from '@/utils/debugLog';

type FilterType = 'all' | 'Buy' | 'Sell' | 'Swap';
type SourceTab = 'wallet' | 'dfx';

const STATE_COLORS: Record<string, string> = {
  Completed: DfxColors.success,
  Processing: DfxColors.warning,
  AmlCheck: DfxColors.warning,
  Created: DfxColors.info,
  Failed: DfxColors.error,
  Returned: DfxColors.error,
};

const NETWORK_LABELS: Record<string, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
  optimism: 'Optimism',
  base: 'Base',
  plasma: 'Plasma',
  sepolia: 'Sepolia',
  spark: 'Spark',
};

const shortenHash = (hash: string): string => {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
};

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [sourceTab, setSourceTab] = useState<SourceTab>('wallet');

  const {
    items: onchainItems,
    error: onchainError,
    isLoading: onchainLoading,
    refetch: refetchOnchain,
    indexerEnabled,
  } = useOnchainTokenTransfers(0);

  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCompletedInitialFetch, setHasCompletedInitialFetch] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadDfxTransactions = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    debugLog('Transactions', 'GET /transaction/detail — start');
    try {
      const data = await dfxTransactionService.getTransactions();
      debugLog('Transactions', 'GET /transaction/detail — ok', { count: data.length });
      setTransactions(data);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : t('transactions.loadFailed');
      debugLog('Transactions', 'GET /transaction/detail — error', {
        message,
        err: err instanceof Error ? err.stack ?? err.message : String(err),
      });
      setLoadError(message);
    } finally {
      setIsRefreshing(false);
      setHasCompletedInitialFetch(true);
    }
  }, [t]);

  useEffect(() => {
    if (sourceTab !== 'dfx') return;
    void loadDfxTransactions();
  }, [sourceTab, loadDfxTransactions]);

  const filtered =
    filter === 'all' ? transactions : transactions.filter((tx) => tx.type === filter);

  const filters: FilterType[] = ['all', 'Buy', 'Sell', 'Swap'];

  const showDfxBlockingLoader =
    sourceTab === 'dfx' &&
    !hasCompletedInitialFetch &&
    transactions.length === 0 &&
    !loadError;

  const onchainRefreshing = onchainLoading && onchainItems.length > 0;

  const renderOnchainRow = (tx: OnchainTransferListItem) => {
    const symbol = tx.token.toUpperCase();
    const titleKey = tx.direction === 'in' ? 'transactions.onchainIn' : 'transactions.onchainOut';
    const date = new Date(tx.timestamp * 1000).toLocaleDateString();
    const networkLabel = NETWORK_LABELS[tx.blockchain] ?? tx.blockchain;

    return (
      <View key={tx.listKey} style={styles.txItem}>
        <View style={styles.txLeft}>
          <Text style={styles.txType}>{t(titleKey, { symbol })}</Text>
          <Text style={styles.txDate}>
            {date} · {networkLabel}
          </Text>
          <Text style={styles.onchainHash}>{shortenHash(tx.hash)}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={styles.txAmount}>
            {tx.direction === 'out' ? '-' : '+'}
            {tx.amount} {symbol}
          </Text>
        </View>
      </View>
    );
  };

  const walletBody = () => {
    if (!indexerEnabled) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('transactions.indexerDisabled')}</Text>
        </View>
      );
    }

    if (onchainError && onchainItems.length > 0) {
      return (
        <>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{onchainError}</Text>
            <Pressable onPress={() => void refetchOnchain()}>
              <Text style={styles.retryLink}>{t('transactions.retry')}</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.txList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={onchainRefreshing}
                onRefresh={() => void refetchOnchain()}
                tintColor={DfxColors.primary}
              />
            }
          >
            {onchainItems.map(renderOnchainRow)}
          </ScrollView>
        </>
      );
    }

    if (onchainLoading && onchainItems.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={DfxColors.primary} />
        </View>
      );
    }

    if (onchainError && onchainItems.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{t('transactions.onchainLoadFailed')}</Text>
          <Text style={styles.errorDetail}>{onchainError}</Text>
          <Pressable style={styles.retryButton} onPress={() => void refetchOnchain()}>
            <Text style={styles.retryLabel}>{t('transactions.retry')}</Text>
          </Pressable>
        </View>
      );
    }

    if (onchainItems.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={onchainLoading}
              onRefresh={() => void refetchOnchain()}
              tintColor={DfxColors.primary}
            />
          }
        >
          <Text style={styles.emptyText}>{t('transactions.noOnchainTransfers')}</Text>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.txList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={onchainRefreshing}
            onRefresh={() => void refetchOnchain()}
            tintColor={DfxColors.primary}
          />
        }
      >
        {onchainItems.map(renderOnchainRow)}
      </ScrollView>
    );
  };

  const dfxBody = () => (
    <>
      {loadError && transactions.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError}</Text>
          <Pressable onPress={() => void loadDfxTransactions()}>
            <Text style={styles.retryLink}>{t('transactions.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {showDfxBlockingLoader ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={DfxColors.primary} />
        </View>
      ) : loadError && transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadDfxTransactions()}>
            <Text style={styles.retryLabel}>{t('transactions.retry')}</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadDfxTransactions()}
              tintColor={DfxColors.primary}
            />
          }
        >
          <Text style={styles.emptyText}>{t('transactions.noTransactions')}</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.txList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadDfxTransactions()}
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
    </>
  );

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>{t('transactions.title')}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sourceTabs}
        >
          <Pressable
            style={[styles.filterChip, sourceTab === 'wallet' && styles.filterChipActive]}
            onPress={() => setSourceTab('wallet')}
          >
            <Text style={[styles.filterText, sourceTab === 'wallet' && styles.filterTextActive]}>
              {t('transactions.walletTab')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, sourceTab === 'dfx' && styles.filterChipActive]}
            onPress={() => setSourceTab('dfx')}
          >
            <Text style={[styles.filterText, sourceTab === 'dfx' && styles.filterTextActive]}>
              {t('transactions.dfxTab')}
            </Text>
          </Pressable>
        </ScrollView>

        {sourceTab === 'wallet' ? (
          walletBody()
        ) : (
          <>
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
            {dfxBody()}
          </>
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
  sourceTabs: {
    gap: 8,
    paddingHorizontal: 24,
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
  emptyScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  emptyText: {
    ...Typography.bodyLarge,
    color: DfxColors.textTertiary,
    textAlign: 'center',
  },
  errorBanner: {
    marginHorizontal: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: DfxColors.surface,
    gap: 8,
  },
  errorBannerText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
  },
  errorText: {
    ...Typography.bodyLarge,
    color: DfxColors.error,
    textAlign: 'center',
  },
  errorDetail: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: DfxColors.primary,
  },
  retryLabel: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.white,
    textAlign: 'center',
  },
  retryLink: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.primary,
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
    flex: 1,
    paddingRight: 8,
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
  onchainHash: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
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
