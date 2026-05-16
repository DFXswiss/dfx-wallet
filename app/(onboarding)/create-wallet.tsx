import { useState } from 'react';
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
import { DfxColors, Typography } from '@/theme';

function isWalletAlreadyExistsError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('already exists');
}

export default function CreateWalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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

const styles = StyleSheet.create({
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
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  warning: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    textAlign: 'center',
  },
  seedCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 16,
  },
  revealButton: {
    minHeight: 168,
    borderRadius: 8,
    backgroundColor: 'rgba(243,246,251,0.9)',
    borderWidth: 1,
    borderColor: DfxColors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  revealText: {
    ...Typography.bodyLarge,
    color: DfxColors.primary,
    fontWeight: '600',
  },
  revealHint: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
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
    backgroundColor: DfxColors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    minWidth: '30%',
  },
  wordIndex: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    width: 24,
  },
  word: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
  },
  copyButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  copyText: {
    ...Typography.bodySmall,
    color: DfxColors.primary,
  },
  error: {
    ...Typography.bodyMedium,
    color: DfxColors.error,
  },
  spacer: {
    flex: 1,
  },
});
