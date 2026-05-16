import { useMemo } from 'react';
import {
  Alert,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, DarkBackdrop, Icon, PrimaryButton } from '@/components';
import { useMultiSigStore } from './store';
import type { MultiSigVault } from './store';
import { Typography, useColors, useResolvedScheme, type ThemeColors } from '@/theme';

const truncateAddress = (addr: string): string => {
  const trimmed = addr.trim();
  if (trimmed.length <= 16) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-6)}`;
};

export default function MultiSigManageScreen() {
  const colors = useColors();
  const scheme = useResolvedScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const vaults = useMultiSigStore((s) => s.vaults);
  const removeVault = useMultiSigStore((s) => s.removeVault);

  const onSetup = () => router.push('/(auth)/multi-sig/setup');

  const onRemove = (vault: MultiSigVault) => {
    Alert.alert(
      t('multiSig.manage.removeTitle'),
      t('multiSig.manage.removeBody', { name: vault.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('multiSig.manage.removeConfirm'),
          style: 'destructive',
          onPress: () => removeVault(vault.id),
        },
      ],
    );
  };

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title={t('multiSig.title')}
        onBack={() => router.back()}
        testID="multi-sig-manage"
      />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {vaults.length === 0 ? (
              <View style={styles.emptyContent}>
                <View style={styles.heroIcon}>
                  <Icon name="shield" size={36} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.emptyTitle}>{t('multiSig.manage.emptyTitle')}</Text>
                <Text style={styles.emptyBody}>{t('multiSig.manage.emptyBody')}</Text>
                <View style={styles.spacer} />
                <PrimaryButton
                  title={t('multiSig.manage.setupCta')}
                  onPress={onSetup}
                  testID="multi-sig-setup-cta"
                />
              </View>
            ) : (
              <View style={styles.listContent}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{t('multiSig.manage.summaryLabel')}</Text>
                  <Text style={styles.summaryValue}>
                    {t('multiSig.manage.summaryValue', { count: vaults.length })}
                  </Text>
                </View>

                {vaults.map((vault) => (
                  <View key={vault.id} style={styles.vaultCard} testID={`vault-${vault.id}`}>
                    <View style={styles.vaultHeader}>
                      <View style={styles.vaultLead}>
                        <Text style={styles.vaultLeadText}>
                          {vault.required}/{vault.total}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vaultName}>{vault.name}</Text>
                        <Text style={styles.vaultMeta}>
                          {t('multiSig.manage.quorumMeta', {
                            required: vault.required,
                            total: vault.total,
                          })}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => onRemove(vault)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('multiSig.manage.removeConfirm')}
                        testID={`vault-${vault.id}-remove`}
                      >
                        <Icon name="close" size={20} color={colors.textTertiary} />
                      </Pressable>
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.cosignerSectionLabel}>
                      {t('multiSig.manage.membersLabel', { count: vault.total })}
                    </Text>

                    <View style={styles.memberRow}>
                      <View style={[styles.avatar, styles.avatarYou]}>
                        <Icon name="user" size={16} color={colors.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberLabel}>{t('multiSig.manage.youLabel')}</Text>
                        <Text style={styles.memberDesc}>{t('multiSig.manage.youDesc')}</Text>
                      </View>
                      <Text style={styles.memberBadge}>{t('multiSig.manage.youBadge')}</Text>
                    </View>

                    {vault.cosigners.map((c, idx) => (
                      <View key={c.id} style={styles.memberRow}>
                        <View style={styles.avatar}>
                          <Icon name="user" size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberLabel}>
                            {c.label ?? t('multiSig.manage.cosignerLabel', { n: idx + 1 })}
                          </Text>
                          <Text style={styles.memberDesc} numberOfLines={1}>
                            {truncateAddress(c.address)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

                <View style={styles.spacer} />
                <PrimaryButton
                  title={t('multiSig.manage.addAnotherCta')}
                  onPress={onSetup}
                  testID="multi-sig-add-another"
                />
              </View>
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
    bg: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
    emptyContent: {
      alignItems: 'center',
      gap: 16,
      paddingTop: 32,
    },
    heroIcon: {
      width: 84,
      height: 84,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      ...Typography.headlineMedium,
      color: colors.text,
      textAlign: 'center',
    },
    emptyBody: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 8,
      lineHeight: 24,
    },
    listContent: {
      gap: 16,
    },
    summaryCard: {
      backgroundColor: 'rgba(220,234,254,0.78)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 4,
    },
    summaryLabel: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    summaryValue: {
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '600',
    },
    vaultCard: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    vaultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    vaultLead: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vaultLeadText: {
      ...Typography.bodyLarge,
      fontWeight: '700',
      color: colors.primary,
    },
    vaultName: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    vaultMeta: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    cosignerSectionLabel: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarYou: {
      backgroundColor: colors.primary,
    },
    memberLabel: {
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    memberDesc: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 1,
    },
    memberBadge: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    spacer: { minHeight: 16 },
  });
