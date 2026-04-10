import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenContainer, PrimaryButton } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function VerifySeedScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // TODO: Implement seed verification (select words in correct order)

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.verifySeed')}</Text>
        <Text style={styles.description}>
          Tap the words in the correct order to verify your seed phrase.
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Seed verification UI</Text>
        </View>

        <PrimaryButton
          title={t('common.continue')}
          onPress={() => router.push('/(onboarding)/setup-pin')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 24,
    gap: 24,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
  },
  description: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
});
