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
import { AppHeader, Icon } from '@/components';
import { defaultLinkedWalletName, useLinkedWalletNames } from '@/hooks';
import { dfxUserService } from '@/services/dfx';
import type { UserAddressDto } from '@/services/dfx/dto';
import { DfxColors, Typography } from '@/theme';

const truncate = (addr: string): string =>
  addr.length <= 18 ? addr : `${addr.slice(0, 10)}…${addr.slice(-6)}`;

export default function LinkedWalletDetailScreen() {
  const params = useLocalSearchParams<{ address: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const targetAddress = String(params.address ?? '');
  const { getName } = useLinkedWalletNames();

  const [linkedAddresses, setLinkedAddresses] = useState<UserAddressDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const wallet = useMemo<UserAddressDto | null>(() => {
    const lc = targetAddress.toLowerCase();
    return linkedAddresses.find((a) => a.address.toLowerCase() === lc) ?? null;
  }, [linkedAddresses, targetAddress]);

  const blockchains = wallet
    ? wallet.blockchains?.length
      ? wallet.blockchains
      : [wallet.blockchain]
    : [];
  const primaryBlockchain = wallet?.blockchain ?? blockchains[0] ?? '';
  // Use the user's custom name across the app — header title, banner copy,
  // accessibility labels — so the same wallet reads identically wherever
  // it surfaces.
  const displayName = wallet
    ? (getName(wallet.address) ?? defaultLinkedWalletName(primaryBlockchain))
    : t('linkedWallet.title');

  const onCopy = async () => {
    if (!wallet) return;
    await Clipboard.setStringAsync(wallet.address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Buy/Sell carry the linked-wallet identity into the existing flows via
  // route params. The buy/sell screens read these to decide whether to show
  // the "send to wallet X" confirmation modal before issuing the DFX call,
  // and to re-auth as the wallet's owner so the credit lands at the right
  // address. Without a wallet object we do not navigate (the buttons are
  // disabled while loading or on error).
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ImageBackground
        source={require('../../../assets/dashboard-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <AppHeader title={displayName} testID="linked-wallet" />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={DfxColors.primary} />
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
                      <Icon name="copy" size={14} color={DfxColors.primary} />
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
                    <Icon name="arrow-down" size={16} color={DfxColors.primary} strokeWidth={2.4} />
                    <Text style={styles.actionLabel}>{t('buy.title')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.actionPill, pressed && styles.pressed]}
                    onPress={() => navigateToFlow('/(auth)/sell')}
                    testID="linked-wallet-sell"
                    accessibilityRole="button"
                    accessibilityLabel={t('sell.title')}
                  >
                    <Icon name="arrow-up" size={16} color={DfxColors.primary} strokeWidth={2.4} />
                    <Text style={styles.actionLabel}>{t('sell.title')}</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.txRow, pressed && styles.pressed]}
                  onPress={() => router.push('/(auth)/transaction-history')}
                  testID="linked-wallet-transactions"
                >
                  <View style={styles.txIcon}>
                    <Icon name="document" size={18} color={DfxColors.primary} />
                  </View>
                  <View style={styles.txBody}>
                    <Text style={styles.txTitle}>{t('linkedWallet.transactions')}</Text>
                    <Text style={styles.txHint}>{t('linkedWallet.transactionsHint')}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={DfxColors.textTertiary} />
                </Pressable>

                <Text style={styles.note}>{t('linkedWallet.note')}</Text>
              </>
            )}
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
    color: DfxColors.error,
    textAlign: 'center',
    paddingVertical: 24,
  },
  addressCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  addressLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.textSecondary,
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
    color: DfxColors.text,
  },
  addressMeta: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: DfxColors.primaryLight,
    borderRadius: 999,
  },
  copyBadgeText: {
    ...Typography.bodySmall,
    color: DfxColors.primary,
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
    backgroundColor: DfxColors.primaryLight,
    borderRadius: 999,
  },
  actionLabel: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '700',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: DfxColors.surface,
    borderRadius: 14,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DfxColors.primaryLight,
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
    color: DfxColors.text,
  },
  txHint: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  note: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
});
