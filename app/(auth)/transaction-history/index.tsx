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
import { useAddresses, type AddressInfo } from '@tetherto/wdk-react-native-core';
import { ScreenContainer } from '@/components';
import { getAssets } from '@/config/tokens';
import { indexerService, type TokenTransfer } from '@/services/indexer-service';
import { dfxTransactionService, type TransactionDto } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

type FilterType = 'all' | 'transfers' | 'dfx';

const DFX_STATE_COLORS: Record<string, string> = {
  Completed: DfxColors.success,
  Processing: DfxColors.warning,
  AmlCheck: DfxColors.warning,
  Created: DfxColors.info,
  Failed: DfxColors.error,
  Returned: DfxColors.error,
};

type UnifiedTransaction =
  | { kind: 'transfer'; data: TokenTransfer }
  | { kind: 'dfx'; data: TransactionDto };

const SYMBOL_MAP: Record<string, string> = { usdt: 'USDT', xaut: 'XAUT', btc: 'BTC' };
const CHAIN_MAP: Record<string, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  spark: 'Spark',
};

const formatTransferAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num === Math.floor(num)) return num.toString();
  return num.toFixed(2);
};

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const { data: addressData } = useAddresses();
  const [transfers, setTransfers] = useState<TokenTransfer[]>([]);
  const [dfxTransactions, setDfxTransactions] = useState<TransactionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const addressMap = buildAddressMap(addressData);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    const [transferResult, dfxResult] = await Promise.allSettled([
      loadTransfers(addressMap),
      dfxTransactionService.getTransactions(),
    ]);

    if (transferResult.status === 'fulfilled') setTransfers(transferResult.value);
    if (dfxResult.status === 'fulfilled') setDfxTransactions(dfxResult.value);

    setIsLoading(false);
  }, [addressMap]);

  useEffect(() => {
    if (addressData && addressData.length > 0) {
      void loadData();
    }
  }, [addressData, loadData]);

  const unified = buildUnifiedList(transfers, dfxTransactions, filter);
  const filters: FilterType[] = ['all', 'transfers', 'dfx'];
  const filterLabels: Record<FilterType, string> = {
    all: 'All',
    transfers: 'On-Chain',
    dfx: 'DFX',
  };

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
                {/* eslint-disable-next-line security/detect-object-injection -- filterLabels keys are the FilterType literal union */}
                {filterLabels[f]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={DfxColors.primary} />
          </View>
        ) : unified.length === 0 ? (
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
                onRefresh={loadData}
                tintColor={DfxColors.primary}
              />
            }
          >
            {unified.map((tx, i) =>
              tx.kind === 'transfer' ? (
                <TransferItem
                  key={`transfer-${tx.data.transactionHash}-${tx.data.transferIndex}`}
                  transfer={tx.data}
                  myAddresses={Object.values(addressMap)}
                />
              ) : (
                <DfxItem key={`dfx-${tx.data.id}-${i}`} tx={tx.data} />
              ),
            )}
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}

function TransferItem({
  transfer,
  myAddresses,
}: {
  transfer: TokenTransfer;
  myAddresses: string[];
}) {
  const isReceive = myAddresses.some((a) => a.toLowerCase() === transfer.to.toLowerCase());
  const symbol = SYMBOL_MAP[transfer.token] ?? transfer.token.toUpperCase();
  const chain = CHAIN_MAP[transfer.blockchain] ?? transfer.blockchain;

  return (
    <View style={styles.txItem}>
      <View style={styles.txLeft}>
        <Text style={styles.txType}>{isReceive ? 'Receive' : 'Send'}</Text>
        <Text style={styles.txDate}>
          {new Date(transfer.timestamp * 1000).toLocaleDateString()} · {chain}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isReceive ? DfxColors.success : DfxColors.text }]}>
          {isReceive ? '+' : '-'}
          {formatTransferAmount(transfer.amount)} {symbol}
        </Text>
      </View>
    </View>
  );
}

function DfxItem({ tx }: { tx: TransactionDto }) {
  return (
    <View style={styles.txItem}>
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
              { backgroundColor: DFX_STATE_COLORS[tx.state] ?? DfxColors.textTertiary },
            ]}
          />
          <Text style={styles.txState}>{tx.state}</Text>
        </View>
      </View>
    </View>
  );
}

function buildAddressMap(data: AddressInfo[] | undefined): Record<string, string> {
  if (!data) return {};
  const map: Record<string, string> = {};
  for (const entry of data) {
    if (entry.accountIndex === 0 && entry.address) {
      map[entry.network] = entry.address;
    }
  }
  return map;
}

async function loadTransfers(addressMap: Record<string, string>): Promise<TokenTransfer[]> {
  if (Object.keys(addressMap).length === 0) return [];

  const assets = getAssets().filter((a) => !a.isNative() && a.getContractAddress());
  const requests = assets
    .map((asset) => {
      const address = addressMap[asset.getNetwork()];
      if (!address) return null;
      return {
        blockchain: asset.getNetwork(),
        token: asset.getSymbol().toLowerCase(),
        address,
        limit: 50,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (requests.length === 0) return [];
  return indexerService.getTokenTransfers(requests);
}

function buildUnifiedList(
  transfers: TokenTransfer[],
  dfxTxs: TransactionDto[],
  filter: FilterType,
): UnifiedTransaction[] {
  const items: UnifiedTransaction[] = [];

  if (filter === 'all' || filter === 'transfers') {
    items.push(...transfers.map((t) => ({ kind: 'transfer' as const, data: t })));
  }
  if (filter === 'all' || filter === 'dfx') {
    items.push(...dfxTxs.map((t) => ({ kind: 'dfx' as const, data: t })));
  }

  return items.sort((a, b) => {
    const tsA = a.kind === 'transfer' ? a.data.timestamp * 1000 : new Date(a.data.date).getTime();
    const tsB = b.kind === 'transfer' ? b.data.timestamp * 1000 : new Date(b.data.date).getTime();
    return tsB - tsA;
  });
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
