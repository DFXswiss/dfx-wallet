import { useEffect, useState, useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { AppHeader, DfxBackgroundScreen, GlassCard, SeedWordTile } from '@/components';
import {
  authenticatePasskey,
  deriveMnemonicFromPrf,
  PasskeyPrfUnsupportedError,
} from '@/features/passkey/services';
import { secureStorage, StorageKeys } from '@/services/storage';
import { seedToWords } from '@/services/wallet';
import { Typography, useColors, type ThemeColors } from '@/theme';

/**
 * Soft import for expo-screen-capture — the native module isn't linked yet
 * in dev/sim builds (`expo prebuild` hasn't run since the package was added).
 * Without this guard the static `import * as ScreenCapture` blows up the
 * whole screen bundle with "Cannot find native module 'ExpoScreenCapture'",
 * which manifests as an Unmatched Route. Once iOS is rebuilt the require
 * succeeds and capture protection kicks in automatically.
 */
type ScreenCaptureApi = {
  preventScreenCaptureAsync: (key?: string) => Promise<unknown>;
  allowScreenCaptureAsync: (key?: string) => Promise<unknown>;
};
let screenCaptureModule: ScreenCaptureApi | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  screenCaptureModule = require('expo-screen-capture') as ScreenCaptureApi;
} catch {
  screenCaptureModule = null;
}

export default function SeedExportScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const [walletOrigin, setWalletOrigin] = useState<string | null>(null);
  const [seedWords, setSeedWords] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  // Defensive — older WDK versions don't always have getMnemonic. Bind via
  // the hook return rather than destructuring at the top so a missing
  // method doesn't take down the entire screen render.
  const wallet = useWalletManager();

  useEffect(() => {
    void secureStorage.get(StorageKeys.WALLET_ORIGIN).then(setWalletOrigin);
  }, []);

  // Block screenshots and the iOS app-switcher snapshot whenever the seed
  // is on screen. expo-screen-capture wires into FLAG_SECURE on Android
  // and the iOS UIScreen capture observer; both are no-ops in the
  // simulator but enforced on real devices. Released on unmount or when
  // the seed is hidden again. Skipped silently if the native module isn't
  // linked yet — that's expected in dev until the next iOS rebuild.
  useEffect(() => {
    if (!seedWords || !screenCaptureModule) return;
    void screenCaptureModule.preventScreenCaptureAsync('seed-export');
    return () => {
      void screenCaptureModule!.allowScreenCaptureAsync('seed-export');
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
      // Seed-flow wallets keep the mnemonic inside WDK' Bare Worklet
      // keychain, not our `expo-secure-store`. The legacy fallback that
      // tried `secureStorage.get(ENCRYPTED_SEED)` always returned null
      // because we never write to that key — exporting was effectively
      // broken for everyone who didn't onboard via passkey. Pull the
      // mnemonic from WDK' authoritative store instead.
      setIsLoading(true);
      try {
        const getMnemonic = wallet?.getMnemonic;
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
    await Clipboard.setStringAsync(seedWords.join(' '));
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
          <GlassCard contentStyle={styles.revealButton} onPress={handleReveal} disabled={isLoading}>
            <Text style={styles.revealText}>
              {isLoading
                ? t('common.loading')
                : isPasskey
                  ? t('seedExport.revealPasskey')
                  : t('seedExport.revealSeed')}
            </Text>
          </GlassCard>
        ) : (
          <>
            <GlassCard tone="warning" style={styles.warningContainer}>
              <Text style={styles.warningText}>{t('seedExport.warning')}</Text>
            </GlassCard>

            <View style={styles.seedContainer}>
              {seedWords.map((word, index) => (
                <SeedWordTile key={index} index={index} word={word} style={styles.wordCard} />
              ))}
            </View>

            <Pressable style={styles.copyButton} onPress={handleCopy}>
              <Text style={styles.copyText}>{copied ? t('common.copied') : t('common.copy')}</Text>
            </Pressable>
          </>
        )}
      </View>
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    revealText: {
      ...Typography.bodyLarge,
      color: colors.primary,
      fontWeight: '600',
    },
    warningContainer: {
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
  });
