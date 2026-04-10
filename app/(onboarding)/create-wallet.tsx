import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ScreenContainer, PrimaryButton } from '@/components';
import { generateSeedPhrase, wordsToSeed } from '@/services/wallet';
import { secureStorage, StorageKeys } from '@/services/storage';
import { DfxColors, Typography } from '@/theme';

export default function CreateWalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [seedWords] = useState(() => generateSeedPhrase(24));
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReveal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRevealed(true);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(wordsToSeed(seedWords));
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const { createWallet } = useWallet();

  const handleContinue = async () => {
    const seed = wordsToSeed(seedWords);
    await secureStorage.set(StorageKeys.ENCRYPTED_SEED, seed);
    // Create WDK wallet with the generated mnemonic
    await createWallet({ name: 'DFX Wallet', mnemonic: seed });
    router.push({
      pathname: '/(onboarding)/verify-seed',
      params: { seed },
    });
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.createWallet')}</Text>
        <Text style={styles.description}>
          Write down your seed phrase and store it in a safe place. This is the only way to recover
          your wallet.
        </Text>

        {!revealed ? (
          <Pressable style={styles.revealButton} onPress={handleReveal}>
            <Text style={styles.revealText}>Tap to reveal seed phrase</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.seedContainer}>
              {seedWords.map((word, index) => (
                <View key={index} style={styles.wordCard}>
                  <Text style={styles.wordIndex}>{index + 1}.</Text>
                  <Text style={styles.word}>{word}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.copyButton} onPress={handleCopy}>
              <Text style={styles.copyText}>{copied ? 'Copied!' : 'Copy to clipboard'}</Text>
            </Pressable>
          </>
        )}

        <View style={styles.spacer} />

        <PrimaryButton
          title={t('common.continue')}
          onPress={handleContinue}
          disabled={!revealed}
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
  spacer: {
    flex: 1,
  },
});
