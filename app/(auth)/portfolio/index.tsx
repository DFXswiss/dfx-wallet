import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { Icon } from '@/components';
import type { ChainId } from '@/config/chains';
import { getAssetMeta, getAssets, WDK_SUPPORTED_CHAINS, type TokenCategory } from '@/config/tokens';
import {
  computeFiatValue,
  formatBalance,
  formatNumber,
  SYMBOL_COLORS,
  SYMBOL_GLYPH,
  toNumeric,
} from '@/config/portfolio-presentation';
import { useEnabledChains } from '@/hooks';
import { useWalletStore } from '@/store';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { DfxColors, Typography } from '@/theme';

type PortfolioGroup = {
  canonicalSymbol: string;
  canonicalName: string;
  category: TokenCategory;
  totalBalanceNum: number;
  totalFiat: number;
  // Distinct networks the canonical asset is held on. USDC + USDT on
  // Ethereum still counts as one network — the user cares about chains, not
  // token variants on the same chain.
  networks: Set<string>;
};

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { enabledChains } = useEnabledChains();
  const { selectedCurrency } = useWalletStore();

  const assetConfigs = useMemo(() => getAssets(enabledChains), [enabledChains]);
  const wdkAssets = useMemo(
    () => assetConfigs.filter((a) => WDK_SUPPORTED_CHAINS.includes(a.getNetwork() as ChainId)),
    [assetConfigs],
  );
  const { data: balanceResults } = useBalancesForWallet(0, wdkAssets);
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
  const currencySymbol = fiatCurrency === FiatCurrency.CHF ? 'CHF' : '$';

  const groups = useMemo<PortfolioGroup[]>(() => {
    const byCanonical = new Map<string, PortfolioGroup>();

    for (const asset of assetConfigs) {
      const meta = getAssetMeta(asset.getId());
      if (!meta) continue;
      // Hide native gas tokens (ETH, MATIC) from the overview — they are
      // tracked for fees but not interesting as a portfolio holding.
      if (meta.category === 'native') continue;
      const result = balanceResults?.find((r) => r.assetId === asset.getId());
      const rawBalance = result?.success ? (result.balance ?? '0') : '0';
      const balance = formatBalance(rawBalance, asset.getDecimals());
      const balanceNum = toNumeric(balance);

      const fiatValue = computeFiatValue(
        balanceNum,
        meta.canonicalSymbol,
        fiatCurrency,
        pricingReady,
      );

      const existing = byCanonical.get(meta.canonicalSymbol);
      if (existing) {
        existing.totalBalanceNum += balanceNum;
        existing.totalFiat += fiatValue;
        existing.networks.add(meta.network);
      } else {
        byCanonical.set(meta.canonicalSymbol, {
          canonicalSymbol: meta.canonicalSymbol,
          canonicalName: meta.canonicalName,
          category: meta.category,
          totalBalanceNum: balanceNum,
          totalFiat: fiatValue,
          networks: new Set([meta.network]),
        });
      }
    }

    const CATEGORY_ORDER: Record<TokenCategory, number> = {
      btc: 0,
      stablecoin: 1,
      native: 2,
      other: 3,
    };

    return Array.from(byCanonical.values()).sort((a, b) => {
      // BTC always first
      if (a.category === 'btc' && b.category !== 'btc') return -1;
      if (a.category !== 'btc' && b.category === 'btc') return 1;
      // Then by balance: non-zero before zero
      if (a.totalBalanceNum > 0 && b.totalBalanceNum === 0) return -1;
      if (a.totalBalanceNum === 0 && b.totalBalanceNum > 0) return 1;
      // Then by fiat value descending
      if (a.totalBalanceNum > 0 && b.totalBalanceNum > 0) return b.totalFiat - a.totalFiat;
      const cat = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
      if (cat !== 0) return cat;
      return a.canonicalSymbol.localeCompare(b.canonicalSymbol);
    });
  }, [assetConfigs, balanceResults, fiatCurrency, pricingReady]);

  const totalFiat = useMemo(() => groups.reduce((sum, g) => sum + g.totalFiat, 0), [groups]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
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
                <Text style={styles.totalValue}>
                  {Number.isFinite(totalFiat)
                    ? (Math.round(totalFiat * 100) / 100).toLocaleString('de-CH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : '0.00'}
                </Text>
              </View>
            </View>

            <View style={styles.assetList}>
              {groups.map((group) => (
                <PortfolioGroupCard
                  key={group.canonicalSymbol}
                  group={group}
                  currencySymbol={currencySymbol}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/portfolio/[symbol]',
                      params: { symbol: group.canonicalSymbol },
                    })
                  }
                />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

type GroupCardProps = {
  group: PortfolioGroup;
  currencySymbol: string;
  onPress: () => void;
};

function PortfolioGroupCard({ group, currencySymbol, onPress }: GroupCardProps) {
  const color = SYMBOL_COLORS.get(group.canonicalSymbol) ?? DfxColors.primary;
  const glyph = SYMBOL_GLYPH.get(group.canonicalSymbol) ?? group.canonicalSymbol.slice(0, 1);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      testID={`portfolio-asset-${group.canonicalSymbol}`}
      accessibilityRole="button"
      accessibilityLabel={group.canonicalName}
    >
      <View style={[styles.iconBubble, { backgroundColor: color }]}>
        <Text style={styles.iconText}>{glyph}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {group.canonicalName}
        </Text>
        <Text style={styles.chainCountText}>
          {group.networks.size === 1 ? '1 network' : `${group.networks.size} networks`}
        </Text>
      </View>
      <View style={styles.balanceColumn}>
        <Text style={styles.fiatValue} numberOfLines={1}>
          {currencySymbol} {group.totalFiat.toFixed(2)}
        </Text>
        <Text style={styles.cryptoBalance} numberOfLines={1}>
          {formatNumber(group.totalBalanceNum)} {group.canonicalSymbol}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingTop: 80,
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
    marginTop: 64,
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
  cardPressed: {
    opacity: 0.7,
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
  chainCountText: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
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
