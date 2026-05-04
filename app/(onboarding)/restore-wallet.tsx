import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ScreenContainer, PrimaryButton } from '@/components';
import { validateSeedPhrase, seedToWords, wordsToSeed } from '@/services/wallet';
import { secureStorage, StorageKeys } from '@/services/storage';
import { DfxColors, Typography } from '@/theme';

export default function RestoreWalletScreen() {
  const router = useRouter();
  const { createWallet } = useWallet();
  const { t } = useTranslation();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const words = seedToWords(seedPhrase);
  const isValid = validateSeedPhrase(words);
  const wordCount = words.length;

  const handleContinue = async () => {
    if (!isValid) {
      setError('Invalid seed phrase. Must be 12 or 24 words.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const seed = wordsToSeed(words);
    await secureStorage.set(StorageKeys.ENCRYPTED_SEED, seed);
    await createWallet({ name: 'DFX Wallet', mnemonic: seed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/(onboarding)/setup-pin');
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.restoreWallet')}</Text>
        <Text style={styles.description}>
          Enter your 12 or 24 word seed phrase to restore your wallet.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
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
          <Text style={styles.wordCount}>
            {wordCount} / {wordCount > 12 ? 24 : 12} words
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.spacer} />

        <PrimaryButton title={t('common.continue')} onPress={handleContinue} disabled={!isValid} />
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
