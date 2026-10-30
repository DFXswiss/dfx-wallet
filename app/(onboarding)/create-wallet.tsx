import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import {
  AppHeader,
  DfxBackgroundScreen,
  GlassCard,
  OnboardingStepIndicator,
  PrimaryButton,
  SeedWordTile,
} from '@/components';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { copySensitive } from '@/services/clipboard';
import { secureStorage, StorageKeys } from '@/services/storage';
import { generateSeedPhrase, wordsToSeed } from '@/services/wallet';
import { isWalletAlreadyExistsError } from '@/services/wallet/wallet-errors';
import { Typography, useColors, type ThemeColors } from '@/theme';

export default function CreateWalletScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const [seedWords] = useState(() => generateSeedPhrase(12));
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captureProtection = useScreenCaptureProtection(revealed, 'create-wallet-seed');
  const canRenderSeed = revealed && captureProtection !== 'pending';

  const handleReveal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRevealed(true);
  };

  const handleCopy = async () => {
    await copySensitive(wordsToSeed(seedWords));
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
      await secureStorage.remove(StorageKeys.WALLET_ORIGIN);
      await secureStorage.remove(StorageKeys.PASSKEY_CREDENTIAL_ID);
      await secureStorage.remove(StorageKeys.PASSKEY_DERIVATION_VERSION);
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

      <GlassCard radius={12}>
        {!revealed ? (
          <GlassCard
            testID="create-wallet-reveal-button"
            variant="quiet"
            padding={24}
            contentStyle={styles.revealButton}
            onPress={handleReveal}
          >
            <Text style={styles.revealText}>{t('onboarding.seedReveal')}</Text>
            <Text style={styles.revealHint}>{t('onboarding.seedRevealHint')}</Text>
          </GlassCard>
        ) : !canRenderSeed ? (
          <ActivityIndicator testID="create-wallet-protection-loading" color={colors.primary} />
        ) : (
          <>
            {captureProtection === 'unavailable' && (
              <View style={styles.captureWarning} testID="create-wallet-capture-warning">
                <Text style={styles.captureWarningText}>
                  {t('common.screenCaptureUnavailable')}
                </Text>
              </View>
            )}
            <View style={styles.seedContainer} testID="create-wallet-seed-container">
              {seedWords.map((word, index) => (
                <SeedWordTile
                  key={index}
                  index={index}
                  word={word}
                  style={styles.wordCardWrap}
                  testID={`create-wallet-word-${index + 1}`}
                />
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
      </GlassCard>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.spacer} />

      <PrimaryButton
        testID="create-wallet-continue-button"
        title={t('common.continue')}
        onPress={handleContinue}
        disabled={!canRenderSeed}
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
    captureWarning: {
      backgroundColor: colors.surfaceLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: 12,
      marginBottom: 12,
    },
    captureWarningText: {
      ...Typography.bodyMedium,
      color: colors.warning,
    },
    revealButton: {
      minHeight: 168,
      alignItems: 'center',
      justifyContent: 'center',
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
    wordCardWrap: {
      width: '31%',
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
