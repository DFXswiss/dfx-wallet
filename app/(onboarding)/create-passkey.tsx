import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import {
  AppHeader,
  DfxBackgroundScreen,
  OnboardingStepIndicator,
  PrimaryButton,
  useAppAlert,
} from '@/components';
import { createPasskey, setupPasskeyWallet, PasskeyPrfUnsupportedError } from '@/services/passkey';
import { DfxColors, Typography } from '@/theme';

export default function CreatePasskeyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { show } = useAppAlert();
  const { restoreWallet } = useWalletManager();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const { prfOutput, credentialId } = await createPasskey();
      await setupPasskeyWallet(prfOutput, credentialId, async (mnemonic) => {
        await restoreWallet(mnemonic, 'default');
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(onboarding)/setup-pin');
    } catch (error) {
      console.warn('create-passkey: setup failed', error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof PasskeyPrfUnsupportedError) {
        const provider = Platform.select({
          ios: 'iCloud Keychain',
          default: 'Google Password Manager',
        });
        show({
          title: t('common.error'),
          message: t('passkey.prfUnsupported', { provider }),
          buttons: [
            { text: t('common.retry'), style: 'cancel' },
            {
              text: t('passkey.useSeedInstead'),
              onPress: () => router.replace('/(onboarding)/create-wallet'),
            },
          ],
        });
      } else {
        show({ title: t('common.error'), message: t('passkey.createError') });
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DfxBackgroundScreen scrollable contentStyle={styles.content} testID="create-passkey-screen">
      <AppHeader
        title={t('passkey.createTitle')}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/(onboarding)/welcome')
        }
        testID="create-passkey"
      />
      <OnboardingStepIndicator current={1} />

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
    </DfxBackgroundScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 4,
    paddingBottom: 24,
    gap: 24,
  },
  description: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  infoContainer: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 14,
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
    backgroundColor: 'rgba(255,255,255,0.78)',
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
