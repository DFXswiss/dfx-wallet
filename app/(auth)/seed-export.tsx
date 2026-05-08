import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ScreenCapture from 'expo-screen-capture';
import { ScreenContainer } from '@/components';
import {
  authenticatePasskey,
  deriveMnemonicFromPrf,
  PasskeyPrfUnsupportedError,
} from '@/services/passkey';
import { secureStorage, StorageKeys } from '@/services/storage';
import { seedToWords } from '@/services/wallet';
import { DfxColors, Typography } from '@/theme';

export default function SeedExportScreen() {
  const { t } = useTranslation();
  const [walletOrigin, setWalletOrigin] = useState<string | null>(null);
  const [seedWords, setSeedWords] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void secureStorage.get(StorageKeys.WALLET_ORIGIN).then(setWalletOrigin);
  }, []);

  // Block screenshots and the iOS app-switcher snapshot whenever the seed
  // is on screen. expo-screen-capture wires into FLAG_SECURE on Android
  // and the iOS UIScreen capture observer; both are no-ops in the
  // simulator but enforced on real devices. Released on unmount or when
  // the seed is hidden again.
  useEffect(() => {
    if (!seedWords) return;
    void ScreenCapture.preventScreenCaptureAsync('seed-export');
    return () => {
      void ScreenCapture.allowScreenCaptureAsync('seed-export');
    };
  }, [seedWords]);

  const isPasskey = walletOrigin === 'passkey';

  const handleReveal = async () => {
    if (isPasskey) {
      setIsLoading(true);
      try {
        const versionStr = await secureStorage.get(StorageKeys.PASSKEY_DERIVATION_VERSION);
        const version = versionStr ? parseInt(versionStr, 10) : 1;
        const { prfOutput } = await authenticatePasskey();
        const mnemonic = deriveMnemonicFromPrf(prfOutput, version);
        setSeedWords(seedToWords(mnemonic));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (error instanceof PasskeyPrfUnsupportedError) {
          const provider = Platform.select({
            ios: 'iCloud Keychain',
            default: 'Google Password Manager',
          });
          Alert.alert(t('common.error'), t('passkey.prfUnsupported', { provider }));
        } else {
          Alert.alert(t('common.error'), t('seedExport.deriveFailed'));
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      const seed = await secureStorage.get(StorageKeys.ENCRYPTED_SEED);
      if (seed) {
        setSeedWords(seedToWords(seed));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Alert.alert(t('common.error'), t('seedExport.deriveFailed'));
      }
    }
  };

  const handleCopy = async () => {
    if (!seedWords) return;
    await Clipboard.setStringAsync(seedWords.join(' '));
    setCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t(isPasskey ? 'settings.seed' : 'settings.seedPhrase')}</Text>
        <Text style={styles.description}>
          {isPasskey ? t('seedExport.descriptionPasskey') : t('seedExport.descriptionSeed')}
        </Text>

        {!seedWords ? (
          <Pressable
            style={[styles.revealButton, isLoading && styles.revealButtonDisabled]}
            onPress={handleReveal}
            disabled={isLoading}
          >
            <Text style={styles.revealText}>
              {isLoading
                ? t('common.loading')
                : isPasskey
                  ? t('seedExport.revealPasskey')
                  : t('seedExport.revealSeed')}
            </Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>{t('seedExport.warning')}</Text>
            </View>

            <View style={styles.seedContainer}>
              {seedWords.map((word, index) => (
                <View key={index} style={styles.wordCard}>
                  <Text style={styles.wordIndex}>{index + 1}.</Text>
                  <Text style={styles.word}>{word}</Text>
                </View>
              ))}
            </View>

            <Pressable style={styles.copyButton} onPress={handleCopy}>
              <Text style={styles.copyText}>{copied ? t('common.copied') : t('common.copy')}</Text>
            </Pressable>
          </>
        )}
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
  revealButtonDisabled: {
    opacity: 0.5,
  },
  revealText: {
    ...Typography.bodyLarge,
    color: DfxColors.primary,
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.warning,
    padding: 16,
  },
  warningText: {
    ...Typography.bodyMedium,
    color: DfxColors.warning,
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
});
