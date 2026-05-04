import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWallet } from '@tetherto/wdk-react-native-provider';
import { ScreenContainer, PrimaryButton } from '@/components';
import {
  createPasskey,
  deriveMnemonicFromPrf,
  PasskeyPrfUnsupportedError,
} from '@/services/passkey';
import { secureStorage, StorageKeys } from '@/services/storage';
import { DfxColors, Typography } from '@/theme';

export default function CreatePasskeyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { createWallet } = useWallet();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const { prfOutput, credentialId } = await createPasskey();
      const mnemonic = deriveMnemonicFromPrf(prfOutput);

      await secureStorage.set(StorageKeys.WALLET_ORIGIN, 'passkey');
      await secureStorage.set(StorageKeys.PASSKEY_CREDENTIAL_ID, credentialId);
      await secureStorage.set(StorageKeys.PASSKEY_DERIVATION_VERSION, '1');
      await createWallet({ name: 'DFX Wallet', mnemonic });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/setup-pin');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof PasskeyPrfUnsupportedError) {
        Alert.alert(t('common.error'), t('passkey.prfUnsupported'), [
          {
            text: t('passkey.useSeedInstead'),
            onPress: () => router.replace('/(onboarding)/create-wallet'),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]);
      } else {
        Alert.alert(t('common.error'), t('passkey.createError'));
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>{t('passkey.createTitle')}</Text>
        <Text style={styles.description}>{t('passkey.createDescription')}</Text>

        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>1</Text>
            <Text style={styles.infoText}>{t('passkey.step1')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>2</Text>
            <Text style={styles.infoText}>{t('passkey.step2')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>3</Text>
            <Text style={styles.infoText}>{t('passkey.step3')}</Text>
          </View>
        </View>

        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>{t('passkey.backupWarning')}</Text>
        </View>

        <View style={styles.spacer} />

        <PrimaryButton
          title={isCreating ? t('common.loading') : t('passkey.createButton')}
          onPress={handleCreate}
          disabled={isCreating}
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
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoIcon: {
    ...Typography.headlineSmall,
    color: DfxColors.primary,
    width: 32,
    height: 32,
    textAlign: 'center',
    lineHeight: 32,
    backgroundColor: DfxColors.surfaceLight,
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoText: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    flex: 1,
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
  spacer: {
    flex: 1,
  },
});
