import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { Icon } from '@/components';
import { getAssetsForCanonicalSymbol, getAssets, getCanonicalNameForSymbol } from '@/config/tokens';
import {
  CHAIN_LABELS,
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

type Holding = {
  id: string;
  network: string;
  chainLabel: string;
  symbol: string;
  name: string;
  balanceNum: number;
  balanceFormatted: string;
  fiatValue: number;
};

export default function AssetDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const canonicalSymbol = String(symbol ?? '').toUpperCase();
  const canonicalName = getCanonicalNameForSymbol(canonicalSymbol);

  const { t } = useTranslation();
  const router = useRouter();
  const { enabledChains } = useEnabledChains();
  const { selectedCurrency } = useWalletStore();

  const holdingMetas = useMemo(
    () => getAssetsForCanonicalSymbol(canonicalSymbol, enabledChains),
    [canonicalSymbol, enabledChains],
  );
  const allAssetConfigs = useMemo(() => getAssets(enabledChains), [enabledChains]);
  const { data: balanceResults } = useBalancesForWallet(0, allAssetConfigs);
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

  const holdings = useMemo<Holding[]>(() => {
    return holdingMetas.map((meta) => {
      const result = balanceResults?.find((r) => r.assetId === meta.id);
      const rawBalance = result?.success ? (result.balance ?? '0') : '0';
      const balanceFormatted = formatBalance(rawBalance, meta.decimals);
      const balanceNum = toNumeric(balanceFormatted);

      const fiatValue = computeFiatValue(balanceNum, canonicalSymbol, fiatCurrency, pricingReady);

      return {
        id: meta.id,
        network: meta.network,
        chainLabel: CHAIN_LABELS.get(meta.network) ?? meta.network,
        symbol: meta.symbol,
        name: meta.name,
        balanceNum,
        balanceFormatted,
        fiatValue,
      };
    });
  }, [holdingMetas, balanceResults, canonicalSymbol, fiatCurrency, pricingReady]);

  const totalBalance = useMemo(
    () => holdings.reduce((sum, h) => sum + h.balanceNum, 0),
    [holdings],
  );
  const totalFiat = useMemo(() => holdings.reduce((sum, h) => sum + h.fiatValue, 0), [holdings]);

  const color = SYMBOL_COLORS.get(canonicalSymbol) ?? DfxColors.primary;
  const glyph = SYMBOL_GLYPH.get(canonicalSymbol) ?? canonicalSymbol.slice(0, 1);

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
              testID="asset-detail-back"
            >
              <Icon name="arrow-left" size={26} color={DfxColors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>{canonicalName}</Text>
            <View style={styles.headerIcon} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.totalCard}>
              <View style={[styles.iconBubble, { backgroundColor: color }]}>
                <Text style={styles.iconText}>{glyph}</Text>
              </View>
              <Text style={styles.totalCrypto}>
                {formatNumber(totalBalance)} {canonicalSymbol}
              </Text>
              <Text style={styles.totalFiat}>
                {currencySymbol} {totalFiat.toFixed(2)}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>{t('portfolio.holdings')}</Text>

            <View style={styles.holdingsList}>
              {holdings.map((holding) => (
                <Pressable
                  key={holding.id}
                  style={({ pressed }) => [styles.holdingRow, pressed && styles.holdingPressed]}
                  testID={`holding-${holding.network}-${holding.symbol}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/transaction-history',
                      params: { asset: holding.symbol, network: holding.network },
                    })
                  }
                >
                  <View style={styles.holdingInfo}>
                    <Text style={styles.holdingChain}>{holding.chainLabel}</Text>
                    <Text style={styles.holdingSymbol}>{holding.symbol}</Text>
                  </View>
                  <View style={styles.holdingBalance}>
                    <Text style={styles.holdingValue}>
                      {currencySymbol} {holding.fiatValue.toFixed(2)}
                    </Text>
                    <Text style={styles.holdingCrypto}>
                      {formatNumber(holding.balanceNum)} {holding.symbol}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerIcon: {
    width: 40,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 12,
  },
  totalCard: {
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1426',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  iconText: {
    color: DfxColors.white,
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 36,
  },
  totalCrypto: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    color: DfxColors.text,
  },
  totalFiat: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    fontWeight: '500',
  },
  sectionLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  holdingsList: {
    gap: 8,
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#0B1426',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  holdingPressed: {
    opacity: 0.7,
  },
  holdingInfo: {
    flex: 1,
    gap: 2,
  },
  holdingChain: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  holdingSymbol: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  holdingBalance: {
    alignItems: 'flex-end',
    gap: 2,
  },
  holdingValue: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  holdingCrypto: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
