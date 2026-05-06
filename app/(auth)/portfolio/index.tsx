import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { Icon } from '@/components';
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
  ['XAUT', '#D4A017'],
  ['MATIC', '#8247E5'],
]);

const SYMBOL_GLYPH = new Map<string, string>([
  ['BTC', '₿'],
  ['WBTC', '₿'],
  ['ETH', 'Ξ'],
  ['USDT', '₮'],
  ['USDC', '$'],
  ['ZCHF', '₣'],
  ['XAUT', 'Au'],
  ['MATIC', '⧫'],
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
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              testID="portfolio-back-button"
            >
              <Icon name="arrow-left" size={26} color={DfxColors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{t('dashboard.portfolio')}</Text>
            <Pressable
              onPress={() => router.push('/(auth)/portfolio/manage')}
              hitSlop={12}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel={t('portfolio.manage')}
              testID="portfolio-manage-button"
            >
              <Text style={styles.manageLink}>{t('portfolio.manage')}</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t('portfolio.totalValue')}</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalCurrency}>{currencySymbol}</Text>
                <Text style={styles.totalValue}>{totalFiat.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.assetList}>
              {sortedAssets.map((asset) => (
                <PortfolioAssetCard key={asset.id} asset={asset} currencySymbol={currencySymbol} />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

type CardProps = {
  asset: PortfolioAsset;
  currencySymbol: string;
};

function PortfolioAssetCard({ asset, currencySymbol }: CardProps) {
  const color = SYMBOL_COLORS.get(asset.symbol) ?? DfxColors.primary;
  const glyph = SYMBOL_GLYPH.get(asset.symbol) ?? asset.symbol.slice(0, 1);
  const chainLabel = CHAIN_LABELS.get(asset.chain) ?? asset.chain;
  return (
    <View style={styles.card}>
      <View style={[styles.iconBubble, { backgroundColor: color }]}>
        <Text style={styles.iconText}>{glyph}</Text>
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
        <Text style={styles.fiatValue} numberOfLines={1}>
          {currencySymbol} {asset.fiatValue.toFixed(2)}
        </Text>
        <Text style={styles.cryptoBalance} numberOfLines={1}>
          {asset.balance} {asset.symbol}
        </Text>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerIcon: {
    minWidth: 80,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  manageLink: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '600',
    textAlign: 'right',
    width: 80,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 12,
  },
  totalCard: {
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  totalCurrency: {
    fontSize: 24,
    color: DfxColors.textTertiary,
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    color: DfxColors.text,
    letterSpacing: -1,
  },
  assetList: {
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: '#0B1426',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1426',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  iconText: {
    color: DfxColors.white,
    fontWeight: '700',
    fontSize: 22,
    lineHeight: 26,
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
    minWidth: 90,
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
