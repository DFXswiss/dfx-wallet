import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AppHeader,
  DfxMark,
  GlassCard,
  GlassSurface,
  Icon,
  ScreenBackdrop,
  Skeleton,
} from '@/components';
import { FEATURES } from '@/config/features';
import { getAssetMeta, getAssets, type TokenCategory } from '@/config/tokens';
import { getRawBalance, useBalances } from '@/services/balances';
import {
  computeFiatValue,
  formatBalance,
  formatNumber,
  resolveFiatCurrency,
  SYMBOL_COLORS,
  SYMBOL_GLYPH,
  toNumeric,
} from '@/config/portfolio-presentation';
import { useEnabledChains } from './useEnabledChains';
import { WalletActions } from './WalletActions';
import {
  defaultLinkedWalletName,
  useLinkedWalletNames,
} from '@/features/linked-wallets/useLinkedWalletNames';
import { useLinkedWalletDiscovery } from '@/features/linked-wallets/useLinkedWalletDiscovery';
import { useLinkedWalletSelection } from '@/features/linked-wallets/useLinkedWalletSelection';
import { dfxUserService } from '@/features/dfx-backend/services';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import { useAuthStore, useWalletStore } from '@/store';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import {
  BackdropText,
  Card,
  IconTile,
  Layout,
  Radius,
  Spacing,
  Typography,
  useColors,
  useResolvedScheme,
  type ResolvedScheme,
  type ThemeColors,
} from '@/theme';

type PortfolioGroup = {
  canonicalSymbol: string;
  canonicalName: string;
  category: TokenCategory;
  totalBalanceNum: number;
  totalFiat: number;
};

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);
  const { enabledChains } = useEnabledChains();
  const { selectedCurrency } = useWalletStore();
  const isDfxAuthenticated = useAuthStore((s) => s.isDfxAuthenticated);
  const { isSelected } = useLinkedWalletSelection();
  const { getName } = useLinkedWalletNames();

  const assetConfigs = useMemo(() => getAssets(enabledChains), [enabledChains]);
  const { data: balances } = useBalances(assetConfigs);
  const [pricingReady, setPricingReady] = useState(pricingService.isReady());
  const [linkedAddresses, setLinkedAddresses] = useState<UserAddressDto[]>([]);
  const [activeAddress, setActiveAddress] = useState<string | null>(null);

  // Pull the DFX-linked wallet list once whenever the screen mounts with an
  // authenticated session. The active address is excluded from the
  // "Linked wallets" rail because the existing portfolio cards above
  // already represent the user's primary holdings.
  useEffect(() => {
    if (!isDfxAuthenticated) {
      setLinkedAddresses([]);
      setActiveAddress(null);
      return;
    }
    let cancelled = false;
    void dfxUserService
      .getUser()
      .then((user) => {
        if (cancelled) return;
        setLinkedAddresses(user.addresses ?? []);
        setActiveAddress(user.activeAddress?.address ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedAddresses([]);
        setActiveAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isDfxAuthenticated]);

  const linkedWalletsUnordered = useMemo(() => {
    const lcActive = activeAddress?.toLowerCase() ?? null;
    return linkedAddresses.filter((a) => {
      const lc = a.address.toLowerCase();
      if (lc === lcActive) return false;
      return isSelected(a.address);
    });
  }, [linkedAddresses, activeAddress, isSelected]);

  // Per-wallet on-chain asset discovery. Scans the curated
  // `DISCOVERABLE_TOKENS` list against each linked wallet's chains so the
  // card sum reflects what the user is actually holding — not just BTC +
  // app-supported stablecoins. Filters tokens without a CoinGecko price
  // out of the sum.
  const fiatCurrencyForLinked = resolveFiatCurrency(selectedCurrency);
  const { data: linkedDiscovery, refetch: refetchDiscovery } = useLinkedWalletDiscovery(
    linkedWalletsUnordered,
    fiatCurrencyForLinked,
    pricingReady,
  );

  // Sort the linked-wallet cards by fiat value DESC so the biggest
  // wallet sits at the top — same convention every portfolio app on the
  // market uses, and the user explicitly asked for it. Wallets that
  // haven't reported a fiat sum yet (discovery still loading or
  // unknown chain) sink to the bottom but keep their relative order.
  const linkedWallets = useMemo(() => {
    const fiatOf = (addr: string): number =>
      linkedDiscovery.get(addr.toLowerCase())?.totalFiat ?? 0;
    return [...linkedWalletsUnordered].sort((a, b) => fiatOf(b.address) - fiatOf(a.address));
  }, [linkedWalletsUnordered, linkedDiscovery]);

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

  const groups = useMemo<PortfolioGroup[]>(() => {
    const byCanonical = new Map<string, PortfolioGroup>();

    for (const asset of assetConfigs) {
      const meta = getAssetMeta(asset.getId());
      if (!meta) continue;
      // Hide native gas tokens (ETH, MATIC) from the overview — they are
      // tracked for fees but not interesting as a portfolio holding.
      if (meta.category === 'native') continue;
      const rawBalance = getRawBalance(balances, asset.getId());
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
      } else {
        byCanonical.set(meta.canonicalSymbol, {
          canonicalSymbol: meta.canonicalSymbol,
          canonicalName: meta.canonicalName,
          category: meta.category,
          totalBalanceNum: balanceNum,
          totalFiat: fiatValue,
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
  }, [assetConfigs, balances, fiatCurrency, pricingReady]);

  // Headline total = local WDK groups + selected linked-wallet discovery
  // fiat. Wallets the discovery couldn't resolve contribute nothing
  // instead of zeroing the headline.
  const linkedWalletsFiat = useMemo(() => {
    let sum = 0;
    for (const wallet of linkedWallets) {
      const entry = linkedDiscovery.get(wallet.address.toLowerCase());
      if (entry?.known) sum += entry.totalFiat;
    }
    return sum;
  }, [linkedWallets, linkedDiscovery]);

  const totalFiat = useMemo(
    () => groups.reduce((sum, g) => sum + g.totalFiat, 0) + linkedWalletsFiat,
    [groups, linkedWalletsFiat],
  );
  const hasHoldings = groups.some((group) => group.totalBalanceNum > 0);
  const showEmptyState = !hasHoldings;
  const visibleGroups = showEmptyState
    ? groups
    : groups.filter((group) => group.totalBalanceNum > 0);

  // Pull-to-refresh: invalidates every balance + pricing source so the
  // user gets a fresh round-trip rather than the staleTime-cached view.
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        pricingService.refresh().catch(() => undefined),
        queryClient.invalidateQueries({ queryKey: ['balances'] }),
        refetchDiscovery(),
        // Re-pull the DFX user payload so a newly-linked wallet shows up
        // immediately after the user adds it on another device.
        isDfxAuthenticated
          ? dfxUserService
              .getUser()
              .then((user) => {
                setLinkedAddresses(user.addresses ?? []);
                setActiveAddress(user.activeAddress?.address ?? null);
              })
              .catch(() => undefined)
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [isDfxAuthenticated, queryClient, refetchDiscovery]);

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title={t('dashboard.portfolio')}
        testID="portfolio"
        rightActionPlain
        rightAction={
          <Pressable
            onPress={() => router.push('/(auth)/portfolio/manage')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('portfolio.manage')}
            testID="portfolio-manage-button"
          >
            <Text style={styles.manageLink}>{t('portfolio.manage')}</Text>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
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

        {balances === undefined ? (
          // Balance fetch hasn't resolved yet — surface skeleton rows in
          // the same shape as PortfolioGroupCard so layout doesn't shift
          // when data lands.
          <View style={styles.assetList}>
            {[0, 1, 2, 3].map((i) => (
              <GlassCard key={i} style={styles.skeletonRow}>
                <Skeleton
                  width={IconTile.md.size}
                  height={IconTile.md.size}
                  radius={IconTile.md.radius}
                />
                <View style={styles.skeletonCopy}>
                  <Skeleton width={'60%'} height={14} radius={6} />
                  <Skeleton width={'40%'} height={11} radius={6} />
                </View>
                <Skeleton width={84} height={16} radius={6} />
              </GlassCard>
            ))}
          </View>
        ) : (
          <>
            {!showEmptyState ? (
              <View style={styles.actionsSection}>
                <WalletActions />
              </View>
            ) : (
              <GlassCard contentStyle={styles.emptyCard} testID="portfolio-empty">
                <Text style={styles.emptyTitle}>{t('portfolio.emptyTitle')}</Text>
                <Text style={styles.emptyText}>{t('portfolio.emptyText')}</Text>
                <View style={styles.emptyActions}>
                  {FEATURES.BUY_SELL ? (
                    <Pressable
                      accessibilityLabel={t('portfolio.actionBuy')}
                      accessibilityRole="button"
                      onPress={() => router.push('/(auth)/buy')}
                      style={({ pressed }) => [
                        styles.emptyButton,
                        styles.emptyBuyButton,
                        pressed && styles.emptyButtonPressed,
                      ]}
                      testID="portfolio-empty-buy"
                    >
                      <View style={styles.emptyDfxMark}>
                        <DfxMark size={15} />
                      </View>
                      <Text style={styles.emptyBuyLabel}>{t('portfolio.actionBuy')}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityLabel={t('portfolio.actionReceive')}
                    accessibilityRole="button"
                    onPress={() => router.push('/(auth)/receive')}
                    style={({ pressed }) => [
                      styles.emptyActionSlot,
                      pressed && styles.emptyButtonPressed,
                    ]}
                    testID="portfolio-empty-receive"
                  >
                    <GlassSurface radius={12} style={styles.emptyButton} variant="quiet">
                      <Text style={styles.emptyReceiveLabel}>{t('portfolio.actionReceive')}</Text>
                    </GlassSurface>
                  </Pressable>
                </View>
              </GlassCard>
            )}

            <View style={styles.assetList}>
              {visibleGroups.map((group) => (
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
          </>
        )}

        {linkedWallets.length > 0 ? (
          <View style={styles.linkedSection}>
            <Text style={styles.linkedSectionLabel}>{t('portfolio.linkedWallets')}</Text>
            <View style={styles.linkedList}>
              {linkedWallets.map((wallet) => {
                const entry = linkedDiscovery.get(wallet.address.toLowerCase());
                const displayName =
                  getName(wallet.address) ?? defaultLinkedWalletName(wallet.blockchain);
                return (
                  <LinkedWalletCard
                    key={wallet.address}
                    wallet={wallet}
                    displayName={displayName}
                    currencySymbol={currencySymbol}
                    fiatValue={entry?.totalFiat ?? 0}
                    fiatKnown={entry?.known ?? false}
                    onPress={() =>
                      router.push({
                        pathname: '/(auth)/linked-wallet/[address]',
                        params: { address: wallet.address },
                      })
                    }
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.bg}>
        <ScreenBackdrop />
        {body}
      </View>
    </>
  );
}

type GroupCardProps = {
  group: PortfolioGroup;
  currencySymbol: string;
  onPress: () => void;
};

function LinkedWalletCard({
  wallet,
  displayName,
  currencySymbol,
  fiatValue,
  fiatKnown,
  onPress,
}: {
  wallet: UserAddressDto;
  displayName: string;
  currencySymbol: string;
  fiatValue: number;
  fiatKnown: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);
  const { address } = wallet;
  const truncated = address.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;
  const chains = (wallet.blockchains?.length ? wallet.blockchains : [wallet.blockchain]).join(
    ' · ',
  );
  // Fiat is known when at least one of the wallet's chains matches a
  // local WDK address. Cards for wallets linked from another device
  // surface a `—` glyph instead of misleading 0.00s.
  const fiatLabel = fiatKnown
    ? `${currencySymbol} ${(Math.round(fiatValue * 100) / 100).toLocaleString('de-CH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : '—';
  return (
    <GlassCard
      contentStyle={styles.linkedCard}
      onPress={onPress}
      testID={`portfolio-linked-wallet-${address.slice(0, 8)}`}
      accessibilityRole="button"
      accessibilityLabel={t('portfolio.linkedWalletA11y', { address: truncated })}
    >
      <View style={[styles.iconBubble, { backgroundColor: colors.primary }]}>
        <Icon name="wallet" size={20} color={colors.white} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.chainCountText} numberOfLines={1}>
          {chains}
        </Text>
      </View>
      <View style={styles.balanceColumn}>
        <Text style={styles.fiatValue} numberOfLines={1}>
          {fiatLabel}
        </Text>
        <Text style={styles.linkedAddress} numberOfLines={1}>
          {truncated}
        </Text>
      </View>
    </GlassCard>
  );
}

function PortfolioGroupCard({ group, currencySymbol, onPress }: GroupCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors, scheme), [colors, scheme]);
  const color = SYMBOL_COLORS.get(group.canonicalSymbol) ?? colors.primary;
  const glyph = SYMBOL_GLYPH.get(group.canonicalSymbol) ?? group.canonicalSymbol.slice(0, 1);
  const name =
    group.category === 'stablecoin'
      ? t(`portfolio.assetName.${group.canonicalSymbol}`)
      : group.canonicalName;
  const subtitle =
    group.category === 'stablecoin'
      ? t('portfolio.stablecoinHint', { currency: group.canonicalSymbol })
      : null;
  return (
    <GlassCard
      contentStyle={styles.card}
      onPress={onPress}
      testID={`portfolio-asset-${group.canonicalSymbol}`}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View
        style={[styles.iconBubble, { backgroundColor: color }]}
        testID={`portfolio-asset-icon-${group.canonicalSymbol}`}
      >
        <Text style={styles.iconText}>{glyph}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? <Text style={styles.chainCountText}>{subtitle}</Text> : null}
      </View>
      <View style={styles.balanceColumn}>
        <Text style={styles.fiatValue} numberOfLines={1}>
          {currencySymbol} {group.totalFiat.toFixed(2)}
        </Text>
        {group.category === 'btc' ? (
          <Text style={styles.cryptoBalance} numberOfLines={1}>
            {formatNumber(group.totalBalanceNum)} {group.canonicalSymbol}
          </Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

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
    manageLink: {
      ...Typography.bodyMedium,
      color: colors.primary,
      fontWeight: '600',
      textAlign: 'right',
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
    totalLabel: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      fontWeight: '500',
      textAlign: 'center',
      ...onBackdrop,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    totalCurrency: {
      fontSize: Typography.headlineSmall.fontSize,
      color: colors.textTertiary,
      fontWeight: '500',
      ...onBackdrop,
    },
    totalValue: {
      fontSize: 46,
      lineHeight: 52,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
      ...onBackdrop,
    },
    actionsSection: {
      marginTop: Spacing.base,
    },
    emptyCard: {
      alignItems: 'center',
      gap: Spacing.md,
      marginTop: Spacing.base,
    },
    emptyTitle: {
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptyText: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      fontWeight: '500',
      textAlign: 'center',
      marginTop: -10,
    },
    emptyActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignSelf: 'stretch',
    },
    emptyActionSlot: {
      flex: 1,
    },
    emptyButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: Radius.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    emptyBuyButton: {
      backgroundColor: colors.primary,
    },
    emptyButtonPressed: {
      opacity: 0.85,
    },
    emptyDfxMark: {
      width: 22,
      height: 22,
      borderRadius: Radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
    emptyBuyLabel: {
      ...Typography.bodyMedium,
      color: colors.white,
      fontWeight: '700',
    },
    emptyReceiveLabel: {
      ...Typography.bodyMedium,
      color: colors.text,
      fontWeight: '700',
    },
    assetList: {
      gap: Layout.listGap,
      marginTop: Spacing.base,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Card.gap,
    },
    skeletonCopy: {
      flex: 1,
      gap: Spacing.xs,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Card.gap,
    },
    linkedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Card.gap,
    },
    iconBubble: {
      width: IconTile.md.size,
      height: IconTile.md.size,
      borderRadius: IconTile.md.radius,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    iconText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 22,
      lineHeight: 26,
    },
    info: {
      flex: 1,
      gap: Spacing.xs,
      minWidth: 0,
    },
    name: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    chainCountText: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    balanceColumn: {
      alignItems: 'flex-end',
      gap: 2,
      minWidth: 98,
      maxWidth: '42%',
    },
    fiatValue: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    cryptoBalance: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    linkedSection: {
      marginTop: Spacing.xl,
    },
    linkedSectionLabel: {
      ...Typography.sectionLabel,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
      ...onBackdrop,
    },
    linkedList: {
      gap: Layout.listGap,
    },
    linkedAddress: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
      fontFamily: 'monospace',
    },
  });
};
