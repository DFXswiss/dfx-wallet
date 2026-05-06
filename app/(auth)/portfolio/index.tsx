import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { AssetListItem, ScreenContainer } from '@/components';
import { getAssets } from '@/config/tokens';
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

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const assetConfigs = useMemo(() => getAssets(), []);
  const { data: balanceResults } = useBalancesForWallet(0, assetConfigs);

  const assets = useMemo<AggregatedAsset[]>(() => {
    if (!balanceResults) return [];

    return balanceResults
      .filter((r) => r.success && r.balance && r.balance !== '0')
      .map((result) => {
        const asset = assetConfigs.find((a) => a.getId() === result.assetId);
        if (!asset) return null;

        return {
          symbol: asset.getSymbol(),
          name: asset.getName(),
          chain: asset.getNetwork(),
          balance: formatBalance(result.balance ?? '0', asset.getDecimals()),
          balanceFiat: '',
        } satisfies AggregatedAsset;
      })
      .filter((asset): asset is AggregatedAsset => asset !== null);
  }, [balanceResults, assetConfigs]);

  return (
    <>
      <Stack.Screen options={{ title: t('dashboard.portfolio'), headerShown: true }} />
      <ScreenContainer scrollable testID="portfolio-screen">
        {assets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('portfolio.empty')}</Text>
            <Text style={styles.emptyDescription}>{t('portfolio.emptyDescription')}</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>
        )}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 16,
    gap: 8,
  },
  emptyState: {
    flex: 1,
    padding: 40,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
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
