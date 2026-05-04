import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ScreenContainer, PrimaryButton } from '@/components';
import {
  authenticatePasskey,
  deriveMnemonicFromPrf,
  PasskeyPrfUnsupportedError,
} from '@/services/passkey';
import { secureStorage, StorageKeys } from '@/services/storage';
import { DfxColors, Typography } from '@/theme';

export default function RestorePasskeyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { createWallet } = useWallet();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const { prfOutput, credentialId } = await authenticatePasskey();
      const mnemonic = deriveMnemonicFromPrf(prfOutput);

      await secureStorage.set(StorageKeys.ENCRYPTED_SEED, mnemonic);
      await secureStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey');
      await secureStorage.set(StorageKeys.PASSKEY_CREDENTIAL_ID, credentialId);
      await createWallet({ name: 'DFX Wallet', mnemonic });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/setup-pin');
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof PasskeyPrfUnsupportedError) {
        Alert.alert(t('common.error'), t('passkey.prfUnsupported'));
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
