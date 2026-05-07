import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { Icon } from '@/components';
import type { ChainId } from '@/config/chains';
import {
  getAssetsForCanonicalSymbol,
  getAssets,
  getCanonicalNameForSymbol,
  getMockRawBalance,
  getAssetMeta,
  WDK_SUPPORTED_CHAINS,
} from '@/config/tokens';
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
  // Short variant label for the holding row's secondary line. For BTC the
  // canonical name is always "Bitcoin", so the row leads with "Bitcoin" on
  // top and just the variant ("SegWit" / "Taproot" / "Lightning" / chain
  // name for wrapped variants) below.
  variantLabel: string;
  canonicalName: string;
  symbol: string;
  name: string;
  balanceNum: number;
  balanceFormatted: string;
  fiatValue: number;
};

const BTC_VARIANT_LABEL: Record<string, string> = {
  bitcoin: 'SegWit',
  'bitcoin-taproot': 'Taproot',
  spark: 'Lightning',
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
  base: 'Base',
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
  const wdkAssets = useMemo(
    () => allAssetConfigs.filter((a) => WDK_SUPPORTED_CHAINS.includes(a.getNetwork() as ChainId)),
    [allAssetConfigs],
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

  const holdings = useMemo<Holding[]>(() => {
    const NETWORK_ORDER: Record<string, number> = {
      ethereum: 0,
      arbitrum: 1,
      polygon: 2,
      base: 3,
      spark: 4,
      plasma: 5,
      sepolia: 6,
    };

    const list = holdingMetas.map((meta) => {
      const result = balanceResults?.find((r) => r.assetId === meta.id);
      const liveRaw = result?.success ? (result.balance ?? '0') : '0';
      const mockRaw = getMockRawBalance(meta.network, meta.symbol, meta.decimals);
      const rawBalance = liveRaw !== '0' ? liveRaw : (mockRaw ?? '0');
      const balanceFormatted = formatBalance(rawBalance, meta.decimals);
      const balanceNum = toNumeric(balanceFormatted);

      const fiatValue = computeFiatValue(balanceNum, canonicalSymbol, fiatCurrency, pricingReady);

      const chainLabel = CHAIN_LABELS.get(meta.network) ?? meta.network;
      const isBtc = meta.canonicalSymbol === 'BTC';
      // For BTC the canonical name (always "Bitcoin") becomes the primary
      // label, so the secondary line shows just the variant. For other
      // canonical groups the chain label is meaningful enough on its own.
      // eslint-disable-next-line security/detect-object-injection -- meta.network is a ChainId literal union
      const variantLabel = isBtc ? (BTC_VARIANT_LABEL[meta.network] ?? chainLabel) : chainLabel;
      return {
        id: meta.id,
        network: meta.network,
        chainLabel,
        variantLabel,
        canonicalName: meta.canonicalName,
        symbol: meta.symbol,
        name: meta.name,
        balanceNum,
        balanceFormatted,
        fiatValue,
      };
    });

    return list.sort((a, b) => {
      const symbolCmp = a.symbol.localeCompare(b.symbol);
      if (symbolCmp !== 0) return symbolCmp;
      return (NETWORK_ORDER[a.network] ?? 99) - (NETWORK_ORDER[b.network] ?? 99);
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
                {currencySymbol}{' '}
                {Number.isFinite(totalFiat)
                  ? (Math.round(totalFiat * 100) / 100).toLocaleString('de-CH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '0.00'}
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
                    <Text style={styles.holdingChain}>{holding.canonicalName}</Text>
                    <Text style={styles.holdingSymbol}>{holding.variantLabel}</Text>
                  </View>
                  <View style={styles.holdingBalance}>
                    <Text style={styles.holdingValue}>
                      {currencySymbol}{' '}
                      {Number.isFinite(holding.fiatValue)
                        ? (Math.round(holding.fiatValue * 100) / 100).toLocaleString('de-CH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '0.00'}
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
