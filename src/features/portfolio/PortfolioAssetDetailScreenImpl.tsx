import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBalancesForWallet } from '@tetherto/wdk-react-native-core';
import { AppHeader, AssetActions, DarkBackdrop } from '@/components';
import type { ChainId } from '@/config/chains';
import {
  getAssetsForCanonicalSymbol,
  getAssets,
  getCanonicalNameForSymbol,
  WDK_SUPPORTED_CHAINS,
} from '@/config/tokens';
import {
  CHAIN_LABELS,
  computeFiatValue,
  formatBalance,
  formatNumber,
  resolveFiatCurrency,
  SYMBOL_COLORS,
  SYMBOL_GLYPH,
  toNumeric,
} from '@/config/portfolio-presentation';
import { useEnabledChains } from './useEnabledChains';
import { useWalletStore } from '@/store';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import {
  BackdropText,
  Card,
  IconTile,
  Interaction,
  Layout,
  Spacing,
  Typography,
  useColors,
  useResolvedScheme,
  type ResolvedScheme,
  type ThemeColors,
} from '@/theme';

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
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);
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

  const fiatCurrency = resolveFiatCurrency(selectedCurrency);
  const currencySymbol =
    fiatCurrency === FiatCurrency.CHF ? 'CHF' : fiatCurrency === FiatCurrency.EUR ? '€' : '$';

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
      const rawBalance = result?.success ? (result.balance ?? '0') : '0';
      const balanceFormatted = formatBalance(rawBalance, meta.decimals);
      const balanceNum = toNumeric(balanceFormatted);

      const fiatValue = computeFiatValue(balanceNum, canonicalSymbol, fiatCurrency, pricingReady);

      const chainLabel = CHAIN_LABELS.get(meta.network) ?? meta.network;
      const isBtc = meta.canonicalSymbol === 'BTC';
      // For BTC the canonical name (always "Bitcoin") becomes the primary
      // label, so the secondary line shows just the variant. For other
      // canonical groups the chain label is meaningful enough on its own.
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

  const color = SYMBOL_COLORS.get(canonicalSymbol) ?? colors.primary;
  const glyph = SYMBOL_GLYPH.get(canonicalSymbol) ?? canonicalSymbol.slice(0, 1);

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader title={canonicalName} testID="asset-detail" />

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
          <View style={styles.actionsRow}>
            <AssetActions asset={canonicalSymbol} testID={`asset-${canonicalSymbol}-actions`} />
          </View>
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
                {/* For canonical groups with multiple stablecoin variants
                        (USD → USDC/USDT, EUR → multiple) the user wants the
                        token symbol on top so they can tell the rows apart;
                        the generic canonical name ("Dollar") is redundant
                        with the screen title. For BTC and other groups where
                        every holding shares the same symbol, fall back to
                        the canonical name + variant label as before. */}
                <Text style={styles.holdingChain}>
                  {holding.symbol !== canonicalSymbol ? holding.symbol : holding.canonicalName}
                </Text>
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
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.bg}>
        {scheme === 'dark' ? (
          <DarkBackdrop baseColor={colors.background} />
        ) : (
          <ImageBackground
            source={require('../../../assets/dashboard-bg.png')}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}
        {body}
      </View>
    </>
  );
}

const cardElevation = (colors: ThemeColors) => ({
  shadowColor: colors.shadow,
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 2,
});

const makeStyles = (colors: ThemeColors, scheme: ResolvedScheme) => {
  const onBackdrop =
    scheme === 'dark' ? { textShadowColor: colors.background, ...BackdropText } : {};

  return StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Layout.screenPadding,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.huge,
      gap: Spacing.base,
    },
    totalCard: {
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.md,
    },
    iconBubble: {
      width: IconTile.lg.size,
      height: IconTile.lg.size,
      borderRadius: IconTile.lg.radius,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    iconText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 30,
      lineHeight: 34,
    },
    totalCrypto: {
      fontSize: 32,
      lineHeight: 36,
      fontWeight: '700',
      color: colors.text,
      ...onBackdrop,
    },
    totalFiat: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      fontWeight: '500',
      ...onBackdrop,
    },
    actionsRow: {
      marginTop: Spacing.md,
      alignSelf: 'stretch',
    },
    sectionLabel: {
      ...Typography.sectionLabel,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
      ...onBackdrop,
    },
    holdingsList: {
      gap: Layout.listGap,
    },
    holdingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardOverlay,
      borderRadius: Card.radius,
      borderWidth: Card.borderWidth,
      borderColor: colors.cardOverlayBorder,
      padding: Card.padding,
      gap: Card.gap,
      ...cardElevation(colors),
    },
    holdingPressed: {
      opacity: Interaction.pressedCardOpacity,
    },
    holdingInfo: {
      flex: 1,
      gap: Spacing.xs,
    },
    holdingChain: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    holdingSymbol: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    holdingBalance: {
      alignItems: 'flex-end',
      gap: 2,
    },
    holdingValue: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    holdingCrypto: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
  });
};
