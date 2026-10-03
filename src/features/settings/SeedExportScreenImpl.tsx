import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { AppHeader, DfxBackgroundScreen, ReauthPinModal } from '@/components';
import {
  authenticatePasskey,
  deriveMnemonicFromPrf,
  PasskeyPrfUnsupportedError,
} from '@/features/passkey/services';
import { useReauthenticate } from '@/hooks/useReauthenticate';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { copySensitive } from '@/services/clipboard';
import { secureStorage, StorageKeys } from '@/services/storage';
import { seedToWords } from '@/services/wallet';
import { Typography, useColors, type ThemeColors } from '@/theme';

type WalletOriginState = 'loading' | 'seed' | 'passkey' | 'error';

type WalletMetadata = {
  credentialId: string | null;
  derivationVersion: string | null;
  origin: string | null;
  state: Exclude<WalletOriginState, 'loading'>;
};

async function readWalletMetadata(): Promise<WalletMetadata> {
  const [origin, credentialId, derivationVersion] = await Promise.all([
    secureStorage.get(StorageKeys.WALLET_ORIGIN),
    secureStorage.get(StorageKeys.PASSKEY_CREDENTIAL_ID),
    secureStorage.get(StorageKeys.PASSKEY_DERIVATION_VERSION),
  ]);
  const state: WalletMetadata['state'] =
    origin === 'passkey' || credentialId !== null || derivationVersion !== null
      ? 'passkey'
      : origin === null
        ? 'seed'
        : 'error';

  return { credentialId, derivationVersion, origin, state };
}

export default function SeedExportScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const [walletOrigin, setWalletOrigin] = useState<WalletOriginState>('loading');
  const [seedWords, setSeedWords] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { requestReauth, modalProps } = useReauthenticate();
  // Defensive — older WDK versions don't always have getMnemonic. Bind via
  // the hook return rather than destructuring at the top so a missing
  // method doesn't take down the entire screen render.
  const wallet = useWalletManager();
  const getMnemonic = wallet?.getMnemonic?.bind(wallet);

  useEffect(() => {
    let mounted = true;
    void readWalletMetadata()
      .then((metadata) => {
        if (mounted) setWalletOrigin(metadata.state);
      })
      .catch(() => {
        if (mounted) setWalletOrigin('error');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const captureProtection = useScreenCaptureProtection(seedWords !== null, 'seed-export');

  const isPasskey = walletOrigin === 'passkey';
  const isOriginReady = walletOrigin === 'seed' || walletOrigin === 'passkey';
  const canRenderSeed = seedWords !== null && captureProtection !== 'pending';

  const handleReveal = async () => {
    if (!isOriginReady) return;
    if (!(await requestReauth())) return;

    let metadata: WalletMetadata;
    try {
      metadata = await readWalletMetadata();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('seedExport.deriveFailed'));
      return;
    }

    if (
      metadata.state === 'error' ||
      metadata.state !== walletOrigin ||
      (metadata.state === 'passkey' && metadata.origin !== 'passkey')
    ) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('seedExport.passkeyVerificationUnavailable'));
      return;
    }

    if (isPasskey) {
      setIsLoading(true);
      try {
        const credentialId = metadata.credentialId;
        if (!credentialId || !getMnemonic) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('common.error'), t('seedExport.passkeyVerificationUnavailable'));
          return;
        }
        const versionStr = metadata.derivationVersion;
        const version = versionStr ? parseInt(versionStr, 10) : 1;
        const { prfOutput } = await authenticatePasskey({ credentialId });
        const mnemonic = deriveMnemonicFromPrf(prfOutput, version);
        const wdkMnemonic = await getMnemonic('default');
        if (!wdkMnemonic) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('common.error'), t('seedExport.passkeyVerificationUnavailable'));
          return;
        }
        if (mnemonic !== wdkMnemonic) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('common.error'), t('seedExport.seedMismatch'));
          return;
        }
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
      // Seed-flow wallets keep the mnemonic inside WDK' Bare Worklet
      // keychain, not our `expo-secure-store`. The legacy fallback that
      // tried `secureStorage.get(ENCRYPTED_SEED)` always returned null
      // because we never write to that key — exporting was effectively
      // broken for everyone who didn't onboard via passkey. Pull the
      // mnemonic from WDK' authoritative store instead.
      setIsLoading(true);
      try {
        const mnemonic = getMnemonic ? await getMnemonic('default') : null;
        if (mnemonic) {
          setSeedWords(seedToWords(mnemonic));
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          // Last-resort fallback for builds where WDK didn't expose
          // getMnemonic. Will alert the user; they can still recover from
          // their original seed paper if they have one.
          const seed = await secureStorage.get(StorageKeys.ENCRYPTED_SEED);
          if (seed) {
            setSeedWords(seedToWords(seed));
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } else {
            Alert.alert(t('common.error'), t('seedExport.deriveFailed'));
          }
        }
      } catch {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('common.error'), t('seedExport.deriveFailed'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopy = async () => {
    if (!seedWords) return;
    await copySensitive(seedWords.join(' '));
    setCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DfxBackgroundScreen scrollable contentStyle={styles.screen} testID="seed-export-screen">
      <AppHeader
        title={t(isPasskey ? 'settings.seed' : 'settings.seedPhrase')}
        onBack={() => router.back()}
        testID="seed-export"
      />
      <View style={styles.content}>
        <Text style={styles.description}>
          {isPasskey ? t('seedExport.descriptionPasskey') : t('seedExport.descriptionSeed')}
        </Text>

        {!seedWords ? (
          <Pressable
            testID="seed-export-reveal-button"
            style={[
              styles.revealButton,
              (isLoading || !isOriginReady) && styles.revealButtonDisabled,
            ]}
            onPress={handleReveal}
            disabled={isLoading || !isOriginReady}
          >
            <Text style={styles.revealText}>
              {walletOrigin === 'loading' || isLoading
                ? t('common.loading')
                : walletOrigin === 'error'
                  ? t('common.error')
                  : isPasskey
                    ? t('seedExport.revealPasskey')
                    : t('seedExport.revealSeed')}
            </Text>
          </Pressable>
        ) : !canRenderSeed ? (
          <ActivityIndicator testID="seed-export-protection-loading" color={colors.primary} />
        ) : (
          <>
            {captureProtection === 'unavailable' && (
              <View style={styles.warningContainer} testID="seed-export-capture-warning">
                <Text style={styles.warningText}>{t('common.screenCaptureUnavailable')}</Text>
              </View>
            )}
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
      <ReauthPinModal {...modalProps} />
    </DfxBackgroundScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      paddingTop: 4,
      paddingBottom: 32,
    },
    content: {
      paddingTop: 24,
      gap: 24,
    },
    title: {
      ...Typography.headlineMedium,
      color: colors.text,
    },
    description: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
    },
    revealButton: {
      padding: 48,
      borderRadius: 12,
      backgroundColor: colors.cardOverlay,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    revealButtonDisabled: {
      opacity: 0.5,
    },
    revealText: {
      ...Typography.bodyLarge,
      color: colors.primary,
      fontWeight: '600',
    },
    warningContainer: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: 16,
    },
    warningText: {
      ...Typography.bodyMedium,
      color: colors.warning,
    },
    seedContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    wordCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardOverlay,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 6,
      width: '31%',
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
  });
