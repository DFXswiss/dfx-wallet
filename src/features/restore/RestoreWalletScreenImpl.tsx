import { useState, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import {
  AppHeader,
  DfxBackgroundScreen,
  OnboardingStepIndicator,
  PrimaryButton,
} from '@/components';
import { validateSeedPhrase, seedToWords, wordsToSeed } from '@/services/wallet';
import { Typography, useColors, type ThemeColors } from '@/theme';

function isWalletAlreadyExistsError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('already exists');
}

export default function RestoreWalletScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { restoreWallet, deleteWallet } = useWalletManager();
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
      try {
        await restoreWallet(seed, 'default');
      } catch (err) {
        if (!isWalletAlreadyExistsError(err)) throw err;

        await deleteWallet('default');
        await restoreWallet(seed, 'default');
      }
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
    <DfxBackgroundScreen scrollable contentStyle={styles.content} testID="restore-wallet-screen">
      <AppHeader
        title={t('onboarding.restoreWallet')}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/(onboarding)/welcome')
        }
        testID="restore-wallet"
      />
      <OnboardingStepIndicator current={1} />

      <View style={styles.intro}>
        <Text style={styles.description}>{t('onboarding.restoreSeedDescription')}</Text>
        <Text style={styles.warning}>{t('onboarding.restoreSeedWarning')}</Text>
      </View>

      <View style={styles.inputCard}>
        <TextInput
          testID="restore-wallet-seed-input"
          style={styles.input}
          value={seedPhrase}
          onChangeText={(text) => {
            setSeedPhrase(text);
            setError(null);
          }}
          placeholder={t('onboarding.restoreSeedPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          blurOnSubmit
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        <Text style={styles.wordCount} testID="restore-wallet-word-count">
          {t('onboarding.seedWordCount', { count: wordCount, total: wordCount > 12 ? 24 : 12 })}
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
    </DfxBackgroundScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingTop: 4,
      paddingBottom: 24,
      gap: 24,
    },
    intro: {
      gap: 12,
    },
    description: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    warning: {
      ...Typography.bodyMedium,
      color: colors.text,
      textAlign: 'center',
    },
    inputCard: {
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    input: {
      backgroundColor: 'rgba(243,246,251,0.9)',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      minHeight: 160,
      color: colors.text,
      ...Typography.bodyLarge,
      textAlignVertical: 'top',
    },
    wordCount: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textAlign: 'right',
    },
    error: {
      ...Typography.bodyMedium,
      color: colors.error,
    },
    spacer: {
      flex: 1,
    },
  });
