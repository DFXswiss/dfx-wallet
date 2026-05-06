import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { ScreenContainer } from '@/components';
import { getAssets, type TokenCategory, getCategoryForAsset } from '@/config/tokens';
import { useEnabledChains } from '@/hooks';
import { useWalletStore } from '@/store';
import { FiatCurrency, pricingService, type AssetTicker } from '@/services/pricing-service';
import { DfxColors, Typography } from '@/theme';

const SYMBOL_TO_TICKER = new Map<string, AssetTicker>([
  ['BTC', 'btc'],
  ['WBTC', 'btc'],
  ['ETH', 'eth'],
  ['USDT', 'usdt'],
  ['USDC', 'usdt'],
  ['XAUT', 'xaut'],
  ['MATIC', 'matic'],
]);

const CHAIN_LABELS = new Map<string, string>([
  ['ethereum', 'Ethereum'],
  ['arbitrum', 'Arbitrum'],
  ['polygon', 'Polygon'],
  ['spark', 'Lightning'],
  ['plasma', 'Plasma'],
  ['sepolia', 'Sepolia'],
]);

const SYMBOL_COLORS = new Map<string, string>([
  ['BTC', '#F7931A'],
  ['WBTC', '#F7931A'],
  ['ETH', '#627EEA'],
  ['USDT', '#26A17B'],
  ['USDC', '#2775CA'],
  ['ZCHF', '#0E1F3A'],
  ['XAUT', '#FFC107'],
  ['MATIC', '#8247E5'],
]);

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

const toNumeric = (formatted: string): number => {
  const n = parseFloat(formatted);
  return Number.isFinite(n) ? n : 0;
};

type PortfolioAsset = {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  category: TokenCategory;
  balance: string;
  balanceNum: number;
  fiatValue: number;
};

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { enabledChains } = useEnabledChains();
  const { selectedCurrency } = useWalletStore();

  const assetConfigs = useMemo(() => getAssets(enabledChains), [enabledChains]);
  const { data: balanceResults } = useBalancesForWallet(0, assetConfigs);
  const [pricingReady, setPricingReady] = useState(pricingService.isReady());

  useEffect(() => {
    if (pricingService.isReady()) {
      setPricingReady(true);
      return;
    }
    void pricingService
      .initialize()
      .then(() => setPricingReady(true))
      .catch(() => setPricingReady(false));
  }, []);

  const fiatCurrency = selectedCurrency === 'CHF' ? FiatCurrency.CHF : FiatCurrency.USD;

  const assets = useMemo<PortfolioAsset[]>(() => {
    return assetConfigs.map((asset) => {
      const result = balanceResults?.find((r) => r.assetId === asset.getId());
      const rawBalance = result?.success ? (result.balance ?? '0') : '0';
      const balance = formatBalance(rawBalance, asset.getDecimals());
      const balanceNum = toNumeric(balance);

      const ticker = SYMBOL_TO_TICKER.get(asset.getSymbol());
      const rate =
        ticker && pricingReady ? pricingService.getExchangeRate(ticker, fiatCurrency) : undefined;
      const stablecoinValue =
        asset.getSymbol() === 'USDC' || asset.getSymbol() === 'USDT' ? balanceNum : 0;
      const fiatValue = rate ? balanceNum * rate : stablecoinValue;

      return {
        id: asset.getId(),
        symbol: asset.getSymbol(),
        name: asset.getName(),
        chain: asset.getNetwork(),
        category: getCategoryForAsset(asset.getId()),
        balance,
        balanceNum,
        fiatValue,
      };
    });
  }, [assetConfigs, balanceResults, fiatCurrency, pricingReady]);

  const sortedAssets = useMemo(() => {
    const CATEGORY_ORDER: Record<TokenCategory, number> = {
      btc: 0,
      stablecoin: 1,
      native: 2,
      other: 3,
    };
    return [...assets].sort((a, b) => {
      if (a.balanceNum > 0 && b.balanceNum === 0) return -1;
      if (a.balanceNum === 0 && b.balanceNum > 0) return 1;
      if (a.balanceNum > 0 && b.balanceNum > 0) return b.fiatValue - a.fiatValue;
      return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    });
  }, [assets]);

  const totalFiat = useMemo(
    () => sortedAssets.reduce((sum, a) => sum + a.fiatValue, 0),
    [sortedAssets],
  );

  const currencySymbol = fiatCurrency === FiatCurrency.CHF ? 'CHF' : '$';

  return (
    <>
      <Stack.Screen
        options={{
          title: t('dashboard.portfolio'),
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(auth)/portfolio/manage')}
              hitSlop={12}
              testID="portfolio-manage-button"
            >
              <Text style={styles.manageLink}>{t('portfolio.manage')}</Text>
            </Pressable>
          ),
        }}
      />
      <ScreenContainer testID="portfolio-screen">
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('portfolio.totalValue')}</Text>
          <Text style={styles.totalValue}>
            {currencySymbol} {totalFiat.toFixed(2)}
          </Text>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedAssets.map((asset) => (
            <PortfolioAssetCard key={asset.id} asset={asset} currencySymbol={currencySymbol} />
          ))}
        </ScrollView>
      </ScreenContainer>
    </>
  );
}

type CardProps = {
  asset: PortfolioAsset;
  currencySymbol: string;
};

function PortfolioAssetCard({ asset, currencySymbol }: CardProps) {
  const color = SYMBOL_COLORS.get(asset.symbol) ?? DfxColors.primary;
  const chainLabel = CHAIN_LABELS.get(asset.chain) ?? asset.chain;
  return (
    <View style={styles.card}>
      <View style={[styles.iconBubble, { backgroundColor: color }]}>
        <Text style={styles.iconText}>{asset.symbol.slice(0, 1)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {asset.name}
        </Text>
        <View style={styles.chainBadge}>
          <Text style={styles.chainText}>{chainLabel}</Text>
        </View>
      </View>
      <View style={styles.balanceColumn}>
        <Text style={styles.fiatValue}>
          {currencySymbol} {asset.fiatValue.toFixed(2)}
        </Text>
        <Text style={styles.cryptoBalance}>
          {asset.balance} {asset.symbol}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  manageLink: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '600',
  },
  totalCard: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  totalLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  totalValue: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    color: DfxColors.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#0B1426',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: DfxColors.white,
    fontWeight: '700',
    fontSize: 18,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  chainBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: DfxColors.surfaceLight,
    borderRadius: 6,
  },
  chainText: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  balanceColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  fiatValue: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  cryptoBalance: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
