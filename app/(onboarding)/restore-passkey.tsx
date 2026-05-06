import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { ScreenContainer, PrimaryButton } from '@/components';
import {
  authenticatePasskey,
  setupPasskeyWallet,
  PasskeyPrfUnsupportedError,
} from '@/services/passkey';
import { DfxColors, Typography } from '@/theme';

export default function RestorePasskeyScreen() {
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
        const provider = Platform.select({ ios: 'iCloud Keychain', default: 'Google Password Manager' });
        Alert.alert(t('common.error'), t('passkey.prfUnsupported', { provider }));
      } else {
        Alert.alert(t('common.error'), t('passkey.restoreError'));
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>{t('passkey.restoreTitle')}</Text>
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
  infoContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  spacer: {
    flex: 1,
  },
});
