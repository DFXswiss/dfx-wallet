import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { ScreenContainer, PrimaryButton } from '@/components';
import { generateSeedPhrase, wordsToSeed } from '@/services/wallet';
import { DfxColors, Typography } from '@/theme';

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

  const { restoreWallet } = useWalletManager();

  const handleContinue = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const seed = wordsToSeed(seedWords);
      await restoreWallet(seed, 'default');
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
    <ScreenContainer scrollable>
      <View style={styles.content} testID="create-wallet-screen">
        <Text style={styles.title}>{t('onboarding.createWallet')}</Text>
        <Text style={styles.description}>
          Write down your seed phrase and store it in a safe place. This is the only way to recover
          your wallet.
        </Text>

        {!revealed ? (
          <Pressable
            testID="create-wallet-reveal-button"
            style={styles.revealButton}
            onPress={handleReveal}
          >
            <Text style={styles.revealText}>Tap to reveal seed phrase</Text>
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
              <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy to clipboard'}</Text>
            </Pressable>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.spacer} />

        <PrimaryButton
          testID="create-wallet-continue-button"
          title={t('common.continue')}
          onPress={handleContinue}
          disabled={!revealed}
          loading={isCreating}
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
  revealButton: {
    padding: 48,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    borderWidth: 1,
    borderColor: DfxColors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealText: {
    ...Typography.bodyLarge,
    color: DfxColors.primary,
    fontWeight: '600',
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
