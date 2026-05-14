import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DfxBackgroundScreen, Icon, PrimaryButton } from '@/components';
import { FEATURES } from '@/config/features';
import { isPasskeySupported } from '@/services/passkey';
import { DfxColors, Typography } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [showRestore, setShowRestore] = useState(false);
  // Passkey support is the AND of an OS gate (iOS 18+ / Android 14+)
  // and the build-time flag — either being off removes the affordance.
  const passkeySupported = isPasskeySupported() && FEATURES.PASSKEY;
  // The restore toggle is the gateway to both seed-restore and
  // passkey-restore; hide it when neither flag is on, so users do not
  // see a control that opens an empty menu.
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
          <Icon name="arrow-left" size={24} color={DfxColors.text} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <Image
          source={require('../../assets/dfx-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>{t('onboarding.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: DfxColors.border,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 24,
  },
  logo: {
    width: 172,
    height: 54,
    marginBottom: 20,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: 14,
  },
  restoreToggle: {
    ...Typography.bodyLarge,
    color: DfxColors.primary,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  restoreOptionText: {
    ...Typography.bodyLarge,
    color: DfxColors.text,
    textAlign: 'center',
  },
});
