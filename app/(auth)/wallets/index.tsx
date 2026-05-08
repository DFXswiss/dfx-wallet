import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAccount } from '@tetherto/wdk-react-native-core';
import { AppHeader, Icon, ScreenContainer } from '@/components';
import { dfxAuthService, dfxUserService, DfxApiError } from '@/services/dfx';
import type { UserAddressDto } from '@/services/dfx/dto';
import { useDfxAuth } from '@/hooks';
import { DfxColors, Typography } from '@/theme';

type LinkableChain = {
  network: 'bitcoin';
  blockchain: 'Bitcoin';
  label: string;
};

const truncate = (addr: string): string => {
  const t = addr.trim();
  if (t.length <= 18) return t;
  return `${t.slice(0, 10)}…${t.slice(-6)}`;
};

const isAddressLinked = (addresses: UserAddressDto[], address: string | null): boolean => {
  if (!address) return false;
  const lc = address.toLowerCase();
  return addresses.some((a) => a.address.toLowerCase() === lc);
};

export default function WalletsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [activeAddress, setActiveAddress] = useState<UserAddressDto | null>(null);
  const [addresses, setAddresses] = useState<UserAddressDto[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isMergedState, setIsMergedState] = useState(false);

  const [linkingChain, setLinkingChain] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { authenticate, isAuthenticating } = useDfxAuth();
  const btc = useAccount({ network: 'bitcoin', accountIndex: 0 });

  const refresh = useCallback(async () => {
    setRefreshError(null);
    setIsMergedState(false);
    try {
      const user = await dfxUserService.getUser();
      setAddresses(user.addresses ?? []);
      setActiveAddress(user.activeAddress ?? null);
    } catch (err) {
      // DFX returns "User is merged" once the current JWT points to an
      // account that was merged into another via the email-confirmation flow.
      // The fix is to re-issue the JWT (the new one will resolve to the
      // merged target user). Detect this and offer a one-tap recovery.
      const message = err instanceof Error ? err.message : t('wallets.loadError');
      if (err instanceof DfxApiError && /user is merged/i.test(message)) {
        setIsMergedState(true);
        setRefreshError(t('wallets.mergedExplanation'));
      } else {
        setRefreshError(message);
      }
    } finally {
      setLoadingUser(false);
    }
  }, [t]);

  const reauthenticate = useCallback(async () => {
    setRefreshError(null);
    setLoadingUser(true);
    try {
      await authenticate();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('wallets.linkError');
      setRefreshError(message);
      setLoadingUser(false);
    }
  }, [authenticate, refresh, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linkBitcoin = async () => {
    if (!btc.address) {
      Alert.alert(t('wallets.linkError'), t('wallets.btcAddressUnavailable'));
      return;
    }
    setLinkingChain('bitcoin');
    setLinkError(null);
    try {
      await dfxAuthService.linkAddress(
        btc.address,
        async (message) => {
          const result = await btc.sign(message);
          if (!result.success) {
            throw new Error(result.error ?? 'Failed to sign message');
          }
          return result.signature;
        },
        { wallet: 'DFX Wallet', blockchain: 'Bitcoin' },
      );
      await refresh();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : t('wallets.linkError'));
    } finally {
      setLinkingChain(null);
    }
  };

  type LinkableRow = LinkableChain & {
    address: string | null;
    busy: boolean;
    onPress: () => void;
  };

  const linkable: LinkableRow[] = [
    {
      network: 'bitcoin' as const,
      blockchain: 'Bitcoin' as const,
      label: t('wallets.bitcoinLabel'),
      address: btc.address ?? null,
      busy: linkingChain === 'bitcoin',
      onPress: () => {
        void linkBitcoin();
      },
    },
  ].filter((c) => !isAddressLinked(addresses, c.address));

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <ScreenContainer scrollable testID="wallets-screen">
        <AppHeader title={t('wallets.title')} onBack={() => router.back()} testID="wallets" />

        <View style={styles.content}>
          <Text style={styles.intro}>{t('wallets.intro')}</Text>

          {loadingUser ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={DfxColors.primary} />
            </View>
          ) : refreshError ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{refreshError}</Text>
              {isMergedState ? (
                <Pressable
                  style={({ pressed }) => [styles.reauthBtn, pressed && styles.pressed]}
                  onPress={() => {
                    void reauthenticate();
                  }}
                  disabled={isAuthenticating}
                  testID="wallets-reauth"
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color={DfxColors.white} />
                  ) : (
                    <Text style={styles.reauthLabel}>{t('wallets.reauthCta')}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>{t('wallets.linkedLabel')}</Text>
              <View style={styles.section}>
                {addresses.length === 0 ? (
                  <Text style={styles.emptyText}>{t('wallets.noAddresses')}</Text>
                ) : (
                  addresses.map((a) => {
                    const isActive =
                      activeAddress?.address.toLowerCase() === a.address.toLowerCase();
                    return (
                      <View key={a.address} style={styles.addressRow}>
                        <View style={[styles.avatar, isActive && styles.avatarActive]}>
                          <Icon
                            name="wallet"
                            size={18}
                            color={isActive ? DfxColors.white : DfxColors.primary}
                          />
                        </View>
                        <View style={styles.addressBody}>
                          <Text style={styles.addressMono} numberOfLines={1}>
                            {truncate(a.address)}
                          </Text>
                          <Text style={styles.addressMeta}>
                            {(a.blockchains?.length ? a.blockchains : [a.blockchain]).join(' · ')}
                          </Text>
                        </View>
                        {isActive ? (
                          <Text style={styles.activeBadge}>{t('wallets.activeBadge')}</Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>

              {linkable.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>{t('wallets.addLabel')}</Text>
                  <View style={styles.section}>
                    {linkable.map((c) => (
                      <Pressable
                        key={c.network}
                        style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                        onPress={c.onPress}
                        disabled={c.busy || !c.address}
                        testID={`wallets-link-${c.network}`}
                      >
                        <View style={styles.avatar}>
                          <Icon name="wallet" size={18} color={DfxColors.primary} />
                        </View>
                        <View style={styles.addressBody}>
                          <Text style={styles.addLabel}>{c.label}</Text>
                          <Text style={styles.addressMeta} numberOfLines={1}>
                            {c.address ? truncate(c.address) : t('wallets.btcAddressUnavailable')}
                          </Text>
                        </View>
                        {c.busy ? (
                          <ActivityIndicator color={DfxColors.primary} />
                        ) : (
                          <Icon name="chevron-right" size={18} color={DfxColors.textTertiary} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}

              <Text style={styles.helper}>{t('wallets.helper')}</Text>
            </>
          )}
        </View>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  intro: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 22,
  },
  sectionLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  section: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  loadingRow: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    textAlign: 'center',
    padding: 18,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DfxColors.border,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: DfxColors.primary,
  },
  addressBody: {
    flex: 1,
    gap: 2,
  },
  addressMono: {
    ...Typography.bodyMedium,
    fontFamily: 'monospace',
    color: DfxColors.text,
  },
  addressMeta: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
  addLabel: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: DfxColors.text,
  },
  activeBadge: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: DfxColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorBlock: {
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  reauthBtn: {
    backgroundColor: DfxColors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reauthLabel: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: DfxColors.white,
  },
  helper: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    paddingHorizontal: 4,
    lineHeight: 18,
    marginTop: 8,
  },
});
