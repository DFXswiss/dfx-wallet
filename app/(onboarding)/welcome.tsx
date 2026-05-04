import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenContainer, PrimaryButton } from '@/components';
import { isPasskeySupported } from '@/services/passkey';
import { DfxColors, Typography } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [showRestore, setShowRestore] = useState(false);
  const passkeySupported = isPasskeySupported();

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.title}>{t('onboarding.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
        </View>

        <View style={styles.actions}>
          {passkeySupported && (
            <PrimaryButton
              title={t('onboarding.createPasskey')}
              onPress={() => router.push('/(onboarding)/create-passkey')}
            />
          )}
          <PrimaryButton
            title={t('onboarding.createWallet')}
            onPress={() => router.push('/(onboarding)/create-wallet')}
            variant={passkeySupported ? 'outlined' : undefined}
          />

          <Pressable onPress={() => setShowRestore(!showRestore)}>
            <Text style={styles.restoreToggle}>{t('onboarding.restoreWallet')}</Text>
          </Pressable>

          {showRestore && (
            <View style={styles.restoreOptions}>
              {passkeySupported && (
                <Pressable
                  style={({ pressed }) => [styles.restoreOption, pressed && styles.pressed]}
                  onPress={() => router.push('/(onboarding)/restore-passkey')}
                >
                  <Text style={styles.restoreOptionText}>{t('onboarding.restorePasskey')}</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.restoreOption, pressed && styles.pressed]}
                onPress={() => router.push('/(onboarding)/restore-wallet')}
              >
                <Text style={styles.restoreOptionText}>{t('onboarding.restoreSeed')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 24,
  },
  title: {
    ...Typography.headlineLarge,
    color: DfxColors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: 16,
  },
  restoreToggle: {
    ...Typography.bodyLarge,
    color: DfxColors.primary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  restoreOptions: {
    gap: 8,
  },
  restoreOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
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
