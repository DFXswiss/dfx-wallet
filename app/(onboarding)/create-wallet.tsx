import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import {
  AppHeader,
  DfxBackgroundScreen,
  OnboardingStepIndicator,
  PrimaryButton,
} from '@/components';
import { generateSeedPhrase, wordsToSeed } from '@/services/wallet';
import { Typography, useColors, type ThemeColors } from '@/theme';

function isWalletAlreadyExistsError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('already exists');
}

export default function CreateWalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [seedWords] = useState(() => generateSeedPhrase(12));
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRevealed(true);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(wordsToSeed(seedWords));
    setCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const { restoreWallet, deleteWallet } = useWalletManager();

  const handleContinue = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const seed = wordsToSeed(seedWords);
      try {
        await restoreWallet(seed, 'default');
      } catch (err) {
        if (!isWalletAlreadyExistsError(err)) throw err;

        await deleteWallet('default');
        await restoreWallet(seed, 'default');
      }
      router.push('/(onboarding)/setup-pin');
    } catch (err) {
      console.warn('create-wallet: failed to create wallet', err);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('onboarding.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DfxBackgroundScreen scrollable contentStyle={styles.content} testID="create-wallet-screen">
      <AppHeader
        title={t('onboarding.createWallet')}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/(onboarding)/welcome')
        }
        testID="create-wallet"
      />
      <OnboardingStepIndicator current={1} />

      <View style={styles.intro}>
        <Text style={styles.description}>{t('onboarding.seedDescription')}</Text>
        <Text style={styles.warning}>{t('onboarding.seedBackupWarning')}</Text>
      </View>

      <View style={styles.seedCard}>
        {!revealed ? (
          <Pressable
            testID="create-wallet-reveal-button"
            style={styles.revealButton}
            onPress={handleReveal}
          >
            <Text style={styles.revealText}>{t('onboarding.seedReveal')}</Text>
            <Text style={styles.revealHint}>{t('onboarding.seedRevealHint')}</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.seedContainer} testID="create-wallet-seed-container">
              {seedWords.map((word, index) => (
                <View
                  key={index}
                  style={styles.wordCard}
                  testID={`create-wallet-word-${index + 1}`}
                >
                  <Text style={styles.wordIndex}>{index + 1}.</Text>
                  <Text style={styles.word}>{word}</Text>
                </View>
              ))}
            </View>

            <Pressable
              testID="create-wallet-copy-button"
              style={styles.copyButton}
              onPress={handleCopy}
            >
              <Text style={styles.copyText}>
                {copied ? t('onboarding.seedCopied') : t('onboarding.seedCopy')}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.spacer} />

      <PrimaryButton
        testID="create-wallet-continue-button"
        title={t('common.continue')}
        onPress={handleContinue}
        disabled={!revealed}
        loading={isCreating}
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
    seedCard: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    revealButton: {
      minHeight: 168,
      borderRadius: 8,
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      // Use the primary tint at low opacity so the dashed reveal cue stays
      // visible against `surfaceLight` in dark mode, where `colors.border`
      // (#1F2A40) blends into the dark card.
      borderColor: colors.primary,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 8,
    },
    revealText: {
      ...Typography.bodyLarge,
      color: colors.primary,
      fontWeight: '600',
    },
    revealHint: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    seedContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    wordCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceLight,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 6,
      minWidth: '30%',
    },
    wordIndex: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      width: 24,
    },
    word: {
      ...Typography.bodyMedium,
      color: colors.text,
    },
    copyButton: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    copyText: {
      ...Typography.bodySmall,
      color: colors.primary,
    },
    error: {
      ...Typography.bodyMedium,
      color: colors.error,
    },
    spacer: {
      flex: 1,
    },
  });
