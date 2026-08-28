import { useState, useMemo } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
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
import { authenticatePasskey, setupPasskeyWallet, PasskeyPrfUnsupportedError } from './services';
import { Typography, useColors, type ThemeColors } from '@/theme';

export default function RestorePasskeyScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const { restoreWallet } = useWalletManager();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const { prfOutput, credentialId } = await authenticatePasskey();
      await setupPasskeyWallet(prfOutput, credentialId, async (mnemonic) => {
        await restoreWallet(mnemonic, 'default');
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/setup-pin');
    } catch (error) {
      console.warn('restore-passkey: restore failed', error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof PasskeyPrfUnsupportedError) {
        const provider = Platform.select({
          ios: 'iCloud Keychain',
          default: 'Google Password Manager',
        });
        Alert.alert(t('common.error'), t('passkey.prfUnsupported', { provider }));
      } else {
        Alert.alert(t('common.error'), t('passkey.restoreError'));
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <DfxBackgroundScreen scrollable contentStyle={styles.content} testID="restore-passkey-screen">
      <AppHeader
        title={t('passkey.restoreTitle')}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/(onboarding)/welcome')
        }
        testID="restore-passkey"
      />
      <OnboardingStepIndicator current={1} />

      <Text style={styles.description}>{t('passkey.restoreDescription')}</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>{t('passkey.restoreInfo')}</Text>
      </View>

      <View style={styles.spacer} />

      <PrimaryButton
        title={isRestoring ? t('common.loading') : t('passkey.restoreButton')}
        onPress={handleRestore}
        disabled={isRestoring}
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
    description: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    infoContainer: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    infoText: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
    },
    spacer: {
      flex: 1,
    },
  });
