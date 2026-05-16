import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { AppHeader, DarkBackdrop, Icon } from '@/components';
import { formatCryptoAmount, resolveFiatCurrency } from '@/config/portfolio-presentation';
import { defaultLinkedWalletName, useLinkedWalletNames } from './useLinkedWalletNames';
import { useLinkedWalletDiscovery } from './useLinkedWalletDiscovery';
import { useWalletTransactions, type WalletTransaction } from './useWalletTransactions';
import { dfxUserService } from '@/features/dfx-backend/services';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { useWalletStore } from '@/store';
import { Typography, useColors, useResolvedScheme, type ThemeColors } from '@/theme';

const truncate = (addr: string): string =>
  addr.length <= 18 ? addr : `${addr.slice(0, 10)}…${addr.slice(-6)}`;

/**
 * Human-readable label for a ChainId — `ethereum` → `Ethereum`,
 * `bitcoin-taproot` → `Bitcoin Taproot`. The Portfolio rail and the
 * Bestände/Transaktionen sections both read this so the user never
 * sees the lowercased internal slug.
 */
function chainLabel(chain: string): string {
  if (!chain) return '';
  return chain
    .split(/[-_]/)
    .map((part) => (part.length === 0 ? '' : part[0]!.toUpperCase() + part.slice(1)))
    .join(' ');
}

/**
 * Wall-clock "x ago" formatter for the TX feed. Avoids a third-party date
 * lib for a single use-case — the precision (hours/days) is plenty for
 * a transaction list.
 */
function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade';
  if (min < 60) return `vor ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `vor ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months} mo`;
  const years = Math.floor(days / 365);
  return `vor ${years} y`;
}

function TransactionRow({ tx, now }: { tx: WalletTransaction; now: number }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sign = tx.direction === 'send' ? '−' : tx.direction === 'receive' ? '+' : '·';
  const color =
    tx.direction === 'send'
      ? colors.error
      : tx.direction === 'receive'
        ? colors.success
        : colors.text;
  return (
    <View style={styles.txRow}>
      <View style={styles.txIcon}>
        <Icon
          name={tx.direction === 'send' ? 'arrow-up' : 'arrow-down'}
          size={18}
          color={colors.primary}
        />
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {tx.symbol} · {chainLabel(tx.chain)}
        </Text>
        <Text style={styles.txHint} numberOfLines={1}>
          {tx.direction === 'send' ? '→ ' : tx.direction === 'receive' ? '← ' : '↔ '}
          {truncate(tx.counterparty || '')}
        </Text>
      </View>
      <View style={styles.txValues}>
        <Text style={[styles.txAmount, { color }]} numberOfLines={1}>
          {sign} {tx.amount} {tx.symbol}
        </Text>
        <Text style={styles.txRelative}>{formatRelative(tx.timestamp, now)}</Text>
      </View>
    </View>
  );
}

export default function LinkedWalletDetailScreen() {
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ address: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { selectedCurrency } = useWalletStore();

  const targetAddress = String(params.address ?? '');
  const { getName } = useLinkedWalletNames();

  const [linkedAddresses, setLinkedAddresses] = useState<UserAddressDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pricingReady, setPricingReady] = useState(pricingService.isReady());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void dfxUserService
      .getUser()
      .then((user) => {
        if (cancelled) return;
        setLinkedAddresses(user.addresses ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('linkedWallet.loadError'));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

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

  const wallet = useMemo<UserAddressDto | null>(() => {
    const lc = targetAddress.toLowerCase();
    return linkedAddresses.find((a) => a.address.toLowerCase() === lc) ?? null;
  }, [linkedAddresses, targetAddress]);

  const blockchains = useMemo(
    () => (wallet ? (wallet.blockchains?.length ? wallet.blockchains : [wallet.blockchain]) : []),
    [wallet],
  );
  const primaryBlockchain = wallet?.blockchain ?? blockchains[0] ?? '';
  const displayName = wallet
    ? (getName(wallet.address) ?? defaultLinkedWalletName(primaryBlockchain))
    : t('linkedWallet.title');

  // Discovery for the single wallet — passed as a one-element array so
  // the existing hook handles staleness/refetch the same way it does
  // for the Portfolio rail. Cached query-key matches the rail's, so we
  // benefit from the warm cache when the user pivots from Portfolio
  // into the detail screen.
  const walletArray = useMemo(() => (wallet ? [wallet] : []), [wallet]);
  const fiatCurrency = resolveFiatCurrency(selectedCurrency);
  const { data: discovery, isLoading: discoveryLoading } = useLinkedWalletDiscovery(
    walletArray,
    fiatCurrency,
    pricingReady,
  );
  const rawWalletDiscovery = wallet ? discovery.get(wallet.address.toLowerCase()) : undefined;
  // Sort the holdings card by fiat value DESC so the most-valuable asset
  // sits at the top. Tokens missing a CoinGecko price (fiatValue null)
  // sink to the bottom while keeping their relative order, mirroring the
  // Portfolio rail's convention.
  const walletDiscovery = useMemo(() => {
    if (!rawWalletDiscovery) return undefined;
    const sortedAssets = [...rawWalletDiscovery.assets].sort(
      (a, b) => (b.fiatValue ?? -Infinity) - (a.fiatValue ?? -Infinity),
    );
    return { ...rawWalletDiscovery, assets: sortedAssets };
  }, [rawWalletDiscovery]);
  const currencySymbol =
    fiatCurrency === FiatCurrency.CHF ? 'CHF' : fiatCurrency === FiatCurrency.EUR ? '€' : '$';

  // Cross-chain transaction feed backed by Blockscout's free, no-key
  // `txlist` + `tokentx` endpoints — always live, no env-var setup
  // required.
  const { data: transactions, isLoading: txLoading } = useWalletTransactions(wallet);
  // `now` is captured once per render so every relative timestamp in
  // the list anchors on the same reference instant — avoids the visual
  // jitter that comes from each row calling `Date.now()` itself.
  const now = Date.now();

  const onCopy = async () => {
    if (!wallet) return;
    await Clipboard.setStringAsync(wallet.address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const navigateToFlow = (path: '/(auth)/buy' | '/(auth)/sell') => {
    if (!wallet) return;
    router.push({
      pathname: path,
      params: {
        targetAddress: wallet.address,
        targetBlockchain: primaryBlockchain,
      },
    });
  };

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AppHeader title={displayName} testID="linked-wallet" />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : !wallet ? (
              <Text style={styles.errorText}>{t('linkedWallet.notFound')}</Text>
            ) : (
              <>
                <View style={styles.addressCard}>
                  <Text style={styles.addressLabel}>{t('linkedWallet.addressLabel')}</Text>
                  <Pressable
                    style={({ pressed }) => [styles.copyBlock, pressed && styles.pressed]}
                    onPress={onCopy}
                    testID="linked-wallet-copy-address"
                  >
                    <Text style={styles.addressMono} numberOfLines={1}>
                      {truncate(wallet.address)}
                    </Text>
                    <View style={styles.copyBadge}>
                      <Icon name="copy" size={14} color={colors.primary} />
                      <Text style={styles.copyBadgeText}>
                        {copied ? t('common.copied') : t('common.copy')}
                      </Text>
                    </View>
                  </Pressable>
                  <Text style={styles.addressMeta} numberOfLines={1}>
                    {blockchains.join(' · ')}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                    onPress={() => navigateToFlow('/(auth)/buy')}
                    testID="linked-wallet-buy"
                    accessibilityRole="button"
                    accessibilityLabel={t('buy.title')}
                  >
                    <Icon name="arrow-down" size={16} color={colors.primary} strokeWidth={2.4} />
                    <Text style={styles.actionLabel}>{t('buy.title')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                    onPress={() => navigateToFlow('/(auth)/sell')}
                    testID="linked-wallet-sell"
                    accessibilityRole="button"
                    accessibilityLabel={t('sell.title')}
                  >
                    <Icon name="arrow-up" size={16} color={colors.primary} strokeWidth={2.4} />
                    <Text style={styles.actionLabel}>{t('sell.title')}</Text>
                  </Pressable>
                </View>

                {/* Assets block — every token the discovery scan found on
                 *  this wallet's chains with a CoinGecko price + non-zero
                 *  balance. Hidden when discovery hasn't returned yet
                 *  (spinner) or when there's nothing to show. */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('linkedWallet.assetsLabel')}</Text>
                  {discoveryLoading && !walletDiscovery ? (
                    <View style={styles.loadingBlock}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  ) : !walletDiscovery || walletDiscovery.assets.length === 0 ? (
                    <Text style={styles.emptyText}>{t('linkedWallet.assetsEmpty')}</Text>
                  ) : (
                    <View style={styles.assetList}>
                      {walletDiscovery.assets.map((asset) => (
                        <View
                          key={`${asset.chain}:${asset.contract ?? 'native'}`}
                          style={styles.assetRow}
                          testID={`linked-wallet-asset-${asset.chain}-${asset.symbol}`}
                        >
                          <View style={styles.assetMain}>
                            <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                            <Text style={styles.assetMeta}>{chainLabel(asset.chain)}</Text>
                          </View>
                          <View style={styles.assetValues}>
                            <Text style={styles.assetFiat}>
                              {asset.fiatValue != null
                                ? `${currencySymbol} ${(Math.round(asset.fiatValue * 100) / 100).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '—'}
                            </Text>
                            <Text style={styles.assetAmount} numberOfLines={1}>
                              {formatCryptoAmount(asset.balance)} {asset.symbol}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* On-chain transaction feed — Blockscout `txlist` +
                 *  `tokentx` merged chronologically across every chain
                 *  this wallet lives on. No API key required. */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('linkedWallet.transactions')}</Text>
                  {txLoading && transactions.length === 0 ? (
                    <View style={styles.loadingBlock}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  ) : transactions.length === 0 ? (
                    <Text style={styles.emptyText}>{t('linkedWallet.txEmpty')}</Text>
                  ) : (
                    <View style={styles.txList}>
                      {transactions.slice(0, 50).map((tx) => (
                        <TransactionRow key={tx.id} tx={tx} now={now} />
                      ))}
                    </View>
                  )}
                </View>

                <Text style={styles.note}>{t('linkedWallet.note')}</Text>
              </>
            )}
          </ScrollView>
    </SafeAreaView>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      {scheme === 'dark' ? (
        <View style={styles.bg}>
          <DarkBackdrop baseColor={colors.background} />
          {body}
        </View>
      ) : (
        <ImageBackground
          source={require('../../../assets/dashboard-bg.png')}
          style={styles.bg}
          resizeMode="cover"
        >
          {body}
        </ImageBackground>
      )}
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 18,
    },
    loadingBlock: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    errorText: {
      ...Typography.bodyMedium,
      color: colors.error,
      textAlign: 'center',
      paddingVertical: 24,
    },
    addressCard: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 10,
    },
    addressLabel: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    copyBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    pressed: {
      opacity: 0.7,
    },
    addressMono: {
      flex: 1,
      ...Typography.bodyLarge,
      fontFamily: 'monospace',
      color: colors.text,
    },
    addressMeta: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    copyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
    },
    copyBadgeText: {
      ...Typography.bodySmall,
      color: colors.primary,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    actionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 22,
      paddingVertical: 12,
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
    },
    actionLabel: {
      ...Typography.bodyMedium,
      color: colors.primary,
      fontWeight: '700',
    },
    section: {
      gap: 10,
    },
    sectionLabel: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 4,
    },
    emptyText: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
      textAlign: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    assetList: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    assetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    assetMain: {
      flex: 1,
      gap: 2,
    },
    assetSymbol: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.text,
    },
    assetMeta: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    assetValues: {
      alignItems: 'flex-end',
      gap: 2,
    },
    assetFiat: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.text,
    },
    assetAmount: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    txList: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    txValues: {
      alignItems: 'flex-end',
      gap: 2,
    },
    txAmount: {
      ...Typography.bodyMedium,
      fontWeight: '700',
    },
    txRelative: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
    },
    txIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txBody: {
      flex: 1,
      gap: 2,
    },
    txTitle: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    txHint: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    note: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      paddingHorizontal: 4,
      lineHeight: 18,
    },
  });
