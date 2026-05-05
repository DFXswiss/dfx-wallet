import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { ScreenContainer, PrimaryButton } from '@/components';
import { validateSeedPhrase, seedToWords, wordsToSeed } from '@/services/wallet';
import { DfxColors, Typography } from '@/theme';

export default function RestoreWalletScreen() {
  const router = useRouter();
  const { restoreWallet } = useWalletManager();
  const { t } = useTranslation();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const words = seedToWords(seedPhrase);
  const isValid = validateSeedPhrase(words);
  const wordCount = words.length;

  const handleContinue = async () => {
    if (!isValid) {
      setError(t('onboarding.invalidSeed'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsRestoring(true);
    setError(null);
    try {
      const seed = wordsToSeed(words);
      await restoreWallet(seed, 'default');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/setup-pin');
    } catch (err) {
      console.warn('restore-wallet: failed to restore', err);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('onboarding.restoreError'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.content} testID="restore-wallet-screen">
        <Text style={styles.title}>{t('onboarding.restoreWallet')}</Text>
        <Text style={styles.description}>
          Enter your 12 or 24 word seed phrase to restore your wallet.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            testID="restore-wallet-seed-input"
            style={styles.input}
            value={seedPhrase}
            onChangeText={(text) => {
              setSeedPhrase(text);
              setError(null);
            }}
            placeholder="Enter seed phrase..."
            placeholderTextColor={DfxColors.textTertiary}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
          <Text style={styles.wordCount} testID="restore-wallet-word-count">
            {wordCount} / {wordCount > 12 ? 24 : 12} words
          </Text>
        </View>

        {error && (
          <Text style={styles.error} testID="restore-wallet-error">
            {error}
          </Text>
        )}

        <View style={styles.spacer} />

        <PrimaryButton
          testID="restore-wallet-continue-button"
          title={t('common.continue')}
          onPress={handleContinue}
          disabled={!isValid}
          loading={isRestoring}
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
  inputContainer: {
    gap: 8,
  },
  input: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
    minHeight: 140,
    color: DfxColors.text,
    ...Typography.bodyLarge,
    textAlignVertical: 'top',
  },
  wordCount: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textAlign: 'right',
  },
  error: {
    ...Typography.bodyMedium,
    color: DfxColors.error,
  },
  spacer: {
    flex: 1,
  },
});
