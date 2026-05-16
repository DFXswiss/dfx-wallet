import { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAccount } from '@tetherto/wdk-react-native-core';
import {
  AppHeader,
  DfxBackgroundScreen,
  EmptyState,
  Icon,
  PrimaryButton,
  RenameWalletModal,
  Skeleton,
} from '@/components';
import { dfxAuthService, dfxUserService, DfxApiError } from '@/features/dfx-backend/services';
import type { UserAddressDto } from '@/features/dfx-backend/services/dto';
import { useDfxAuth } from '@/hooks';
import {
  defaultLinkedWalletName,
  useLinkedWalletNames,
} from '@/features/linked-wallets/useLinkedWalletNames';
import { useLinkedWalletSelection } from '@/features/linked-wallets/useLinkedWalletSelection';
import { Typography, useColors, type ThemeColors } from '@/theme';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();

  const [activeAddress, setActiveAddress] = useState<UserAddressDto | null>(null);
  const [addresses, setAddresses] = useState<UserAddressDto[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isMergedState, setIsMergedState] = useState(false);

  const [linkingChain, setLinkingChain] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const { reauthenticateAsOwner, isAuthenticating } = useDfxAuth();
  const { isSelected, toggle: toggleLinkedWallet } = useLinkedWalletSelection();
  const { getName, setName } = useLinkedWalletNames();
  const [renamingWallet, setRenamingWallet] = useState<UserAddressDto | null>(null);
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
      await reauthenticateAsOwner();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('wallets.linkError');
      setRefreshError(message);
      setLoadingUser(false);
    }
  }, [reauthenticateAsOwner, refresh, t]);

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
      <DfxBackgroundScreen scrollable contentStyle={styles.screen} testID="wallets-screen">
        <AppHeader title={t('wallets.title')} testID="wallets" />

        <View style={styles.content}>
          <Text style={styles.intro}>{t('wallets.intro')}</Text>

          {loadingUser ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width={36} height={36} radius={18} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width={'55%'} height={14} radius={6} />
                    <Skeleton width={'80%'} height={11} radius={6} />
                  </View>
                </View>
              ))}
            </View>
          ) : refreshError ? (
            <EmptyState
              icon={isMergedState ? 'shield' : 'user'}
              title={isMergedState ? t('wallets.mergedTitle') : t('wallets.loadErrorTitle')}
              description={isMergedState ? refreshError : t('wallets.loadErrorHint')}
              testID="wallets-error"
              action={
                <PrimaryButton
                  title={
                    isMergedState ? t('wallets.reauthCta') : t('wallets.loadErrorCta')
                  }
                  loading={isAuthenticating || loadingUser}
                  onPress={() => {
                    if (isMergedState) void reauthenticate();
                    else router.push('/(auth)/kyc');
                  }}
                  testID="wallets-recover"
                />
              }
            />
          ) : (
            <>
              <Text style={styles.sectionLabel}>{t('wallets.linkedLabel')}</Text>
              {addresses.length > 0 ? (
                <Text style={styles.selectHint}>{t('wallets.selectHint')}</Text>
              ) : null}
              <View style={styles.section}>
                {addresses.length === 0 ? (
                  <Text style={styles.emptyText}>{t('wallets.noAddresses')}</Text>
                ) : (
                  addresses.map((a) => {
                    const isActive =
                      activeAddress?.address.toLowerCase() === a.address.toLowerCase();
                    // The active address is always implicitly part of the
                    // user's portfolio (their primary wallet shows the
                    // local WDK balances). Checkbox only applies to the
                    // additional linked wallets.
                    const showCheckbox = !isActive;
                    const checked = showCheckbox && isSelected(a.address);
                    const displayName = getName(a.address) ?? defaultLinkedWalletName(a.blockchain);
                    return (
                      <Pressable
                        key={a.address}
                        style={({ pressed }) => [
                          styles.addressRow,
                          showCheckbox && pressed && styles.pressed,
                        ]}
                        onPress={() => {
                          if (!showCheckbox) return;
                          void toggleLinkedWallet(a.address);
                        }}
                        disabled={!showCheckbox}
                        testID={`wallets-address-${a.address.slice(0, 8)}`}
                      >
                        <View style={[styles.avatar, isActive && styles.avatarActive]}>
                          <Icon
                            name="wallet"
                            size={18}
                            color={isActive ? colors.white : colors.primary}
                          />
                        </View>
                        <View style={styles.addressBody}>
                          <View style={styles.nameRow}>
                            <Text style={styles.walletName} numberOfLines={1}>
                              {displayName}
                            </Text>
                            <Pressable
                              hitSlop={10}
                              style={({ pressed }) => [
                                styles.editButton,
                                pressed && styles.pressed,
                              ]}
                              onPress={() => setRenamingWallet(a)}
                              testID={`wallets-rename-${a.address.slice(0, 8)}`}
                              accessibilityRole="button"
                              accessibilityLabel={t('linkedWallet.rename.cta')}
                            >
                              <Icon name="edit" size={16} color={colors.primary} />
                            </Pressable>
                          </View>
                          <Text style={styles.addressMono} numberOfLines={1}>
                            {truncate(a.address)}
                          </Text>
                          <Text style={styles.addressMeta}>
                            {(a.blockchains?.length ? a.blockchains : [a.blockchain]).join(' · ')}
                          </Text>
                        </View>
                        {isActive ? (
                          <Text style={styles.activeBadge}>{t('wallets.activeBadge')}</Text>
                        ) : (
                          <View
                            style={[styles.checkbox, checked && styles.checkboxChecked]}
                            testID={`wallets-checkbox-${checked ? 'on' : 'off'}-${a.address.slice(0, 8)}`}
                          >
                            {checked ? <Icon name="check" size={14} color={colors.white} /> : null}
                          </View>
                        )}
                      </Pressable>
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
                          <Icon name="wallet" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.addressBody}>
                          <Text style={styles.addLabel}>{c.label}</Text>
                          <Text style={styles.addressMeta} numberOfLines={1}>
                            {c.address ? truncate(c.address) : t('wallets.btcAddressUnavailable')}
                          </Text>
                        </View>
                        {c.busy ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : (
                          <Icon name="chevron-right" size={18} color={colors.textTertiary} />
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
      </DfxBackgroundScreen>
      <RenameWalletModal
        visible={renamingWallet !== null}
        initialName={renamingWallet ? (getName(renamingWallet.address) ?? '') : ''}
        defaultName={
          renamingWallet ? defaultLinkedWalletName(renamingWallet.blockchain) : 'DFX Wallet'
        }
        walletAddressShort={renamingWallet ? truncate(renamingWallet.address) : ''}
        onClose={() => setRenamingWallet(null)}
        onSave={(name) => {
          const target = renamingWallet;
          if (!target) return;
          void setName(target.address, name).then(() => setRenamingWallet(null));
        }}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      paddingTop: 4,
      paddingBottom: 32,
    },
    content: {
      paddingTop: 12,
      gap: 12,
    },
    intro: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    sectionLabel: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 4,
      marginTop: 8,
    },
    section: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    loadingRow: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    skeletonList: {
      paddingVertical: 8,
      gap: 14,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    emptyText: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
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
      borderBottomColor: colors.border,
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
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarActive: {
      backgroundColor: colors.primary,
    },
    addressBody: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    walletName: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    editButton: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addressMono: {
      ...Typography.bodyMedium,
      fontFamily: 'monospace',
      color: colors.text,
    },
    addressMeta: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    addLabel: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    activeBadge: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    selectHint: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      paddingHorizontal: 4,
      lineHeight: 18,
    },
    errorBlock: {
      gap: 12,
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorText: {
      ...Typography.bodySmall,
      color: colors.error,
      textAlign: 'center',
    },
    reauthBtn: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
    },
    reauthLabel: {
      ...Typography.bodyMedium,
      fontWeight: '700',
      color: colors.white,
    },
    helper: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      paddingHorizontal: 4,
      lineHeight: 18,
      marginTop: 8,
    },
  });
