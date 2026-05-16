import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BrandLogo, DfxBackgroundScreen, Icon, PrimaryButton } from '@/components';
import { FEATURES } from '@/config/features';
import { isPasskeyOsSupported } from '@/config/platform';
import { Typography, useColors, type ThemeColors } from '@/theme';

type WelcomeFeatureIcon = 'shield' | 'globe' | 'wallet';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showRestore, setShowRestore] = useState(false);

  function FeatureRow({ icon, label }: { icon: WelcomeFeatureIcon; label: string }) {
    return (
      <View style={styles.featureRow}>
        <View style={styles.featureIcon}>
          <Icon name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={styles.featureLabel}>{label}</Text>
      </View>
    );
  }
  const passkeySupported = FEATURES.PASSKEY && isPasskeyOsSupported();
  const showRestoreToggle = FEATURES.RESTORE || passkeySupported;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <DfxBackgroundScreen contentStyle={styles.content} testID="welcome-screen">
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="welcome-back-button"
        >
          <Icon name="arrow-left" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <BrandLogo size="hero" />
        </View>
        <Text style={styles.title}>{t('onboarding.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>

        <View style={styles.featureList}>
          <FeatureRow icon="shield" label={t('onboarding.featureSelfCustody')} />
          <FeatureRow icon="globe" label={t('onboarding.featureSwiss')} />
          <FeatureRow icon="wallet" label={t('onboarding.featureMultiChain')} />
        </View>
      </View>

      <View style={styles.actions}>
        {passkeySupported && (
          <PrimaryButton
            title={t('onboarding.createPasskey')}
            onPress={() => router.push('/(onboarding)/create-passkey')}
            testID="welcome-create-passkey-button"
          />
        )}
        <PrimaryButton
          testID="welcome-create-wallet-button"
          title={t('onboarding.createWallet')}
          onPress={() => router.push('/(onboarding)/create-wallet')}
          {...(passkeySupported ? { variant: 'outlined' as const } : {})}
        />

        {showRestoreToggle && (
          <>
            <Pressable testID="welcome-restore-toggle" onPress={() => setShowRestore(!showRestore)}>
              <Text style={styles.restoreToggle}>{t('onboarding.restoreWallet')}</Text>
            </Pressable>

            {showRestore && (
              <View style={styles.restoreOptions}>
                {passkeySupported && (
                  <Pressable
                    testID="welcome-restore-passkey-button"
                    style={({ pressed }) => [styles.restoreOption, pressed && styles.pressed]}
                    onPress={() => router.push('/(onboarding)/restore-passkey')}
                  >
                    <Text style={styles.restoreOptionText}>{t('onboarding.restorePasskey')}</Text>
                  </Pressable>
                )}
                {FEATURES.RESTORE && (
                  <Pressable
                    testID="welcome-restore-seed-button"
                    style={({ pressed }) => [styles.restoreOption, pressed && styles.pressed]}
                    onPress={() => router.push('/(onboarding)/restore-wallet')}
                  >
                    <Text style={styles.restoreOptionText}>{t('onboarding.restoreSeed')}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </DfxBackgroundScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      justifyContent: 'space-between',
      paddingTop: 4,
      paddingBottom: 16,
    },
    topBar: {
      height: 44,
      justifyContent: 'center',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardOverlay,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingBottom: 24,
    },
    logoWrap: {
      marginBottom: 20,
    },
    title: {
      ...Typography.headlineMedium,
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    featureList: {
      marginTop: 32,
      gap: 14,
      alignSelf: 'stretch',
      paddingHorizontal: 8,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    featureIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureLabel: {
      ...Typography.bodyMedium,
      color: colors.text,
      flexShrink: 1,
    },
    actions: {
      gap: 14,
    },
    restoreToggle: {
      ...Typography.bodyLarge,
      color: colors.primary,
      textAlign: 'center',
      paddingVertical: 10,
      fontWeight: '500',
    },
    restoreOptions: {
      gap: 8,
    },
    restoreOption: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: {
      opacity: 0.7,
    },
    restoreOptionText: {
      ...Typography.bodyLarge,
      color: colors.text,
      textAlign: 'center',
    },
  });
