import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components';
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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={DfxColors.primary}
                colors={[DfxColors.primary]}
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

            {groups.length > 0 ? (
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
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('portfolio.empty')}</Text>
                <Text style={styles.emptyDescription}>{t('portfolio.emptyDescription')}</Text>
              </View>
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
      </ImageBackground>
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      testID={`portfolio-linked-wallet-${address.slice(0, 8)}`}
      accessibilityRole="button"
      accessibilityLabel={t('portfolio.linkedWalletA11y', { address: truncated })}
    >
      <View style={[styles.iconBubble, { backgroundColor: DfxColors.primary }]}>
        <Icon name="wallet" size={20} color={DfxColors.white} />
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
    </Pressable>
  );
}

function PortfolioGroupCard({ group, currencySymbol, onPress }: GroupCardProps) {
  const { t } = useTranslation();
  const color = SYMBOL_COLORS.get(group.canonicalSymbol) ?? DfxColors.primary;
  const glyph = SYMBOL_GLYPH.get(group.canonicalSymbol) ?? group.canonicalSymbol.slice(0, 1);
  const networkLabel =
    group.networks.size === 1
      ? t('portfolio.networkCount_one', { count: group.networks.size })
      : t('portfolio.networkCount_other', { count: group.networks.size });
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
        <Text style={styles.chainCountText}>{networkLabel}</Text>
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
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerIcon: {
    minWidth: 80,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 48,
    gap: 14,
  },
  totalLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  totalCurrency: {
    fontSize: 26,
    color: DfxColors.textTertiary,
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '700',
    color: DfxColors.text,
    flexShrink: 1,
  },
  assetList: {
    gap: 10,
    marginTop: 22,
  },
  emptyCard: {
    marginTop: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: DfxColors.text,
  },
  emptyDescription: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(221,229,240,0.9)',
    padding: 14,
    gap: 12,
    shadowColor: '#0B1426',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 15,
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
    minWidth: 0,
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
    minWidth: 98,
    maxWidth: '42%',
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
  linkedSection: {
    marginTop: 24,
    gap: 10,
  },
  linkedSectionLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  linkedList: {
    gap: 8,
  },
  linkedAddress: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
    fontFamily: 'monospace',
  },
});
