import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenContainer, PrimaryButton } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.title}>{t('onboarding.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title={t('onboarding.createWallet')}
            onPress={() => router.push('/(onboarding)/create-wallet')}
          />
          <PrimaryButton
            title={t('onboarding.restoreWallet')}
            onPress={() => router.push('/(onboarding)/restore-wallet')}
            variant="outlined"
          />
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
});
