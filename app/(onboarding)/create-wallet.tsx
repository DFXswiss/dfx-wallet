import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenContainer, PrimaryButton } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function CreateWalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // TODO: Generate seed phrase via WDK and display mnemonic words
  const seedWords: string[] = [];

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.createWallet')}</Text>
        <Text style={styles.description}>
          Write down your seed phrase and store it in a safe place. This is the only way to recover
          your wallet.
        </Text>

        <View style={styles.seedContainer}>
          {seedWords.map((word, index) => (
            <View key={index} style={styles.wordCard}>
              <Text style={styles.wordIndex}>{index + 1}</Text>
              <Text style={styles.word}>{word}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton
          title={t('common.continue')}
          onPress={() => router.push('/(onboarding)/verify-seed')}
          disabled={seedWords.length === 0}
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
  seedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  wordIndex: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    width: 20,
  },
  word: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
  },
});
