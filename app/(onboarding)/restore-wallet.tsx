import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenContainer, PrimaryButton } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function RestoreWalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [seedPhrase, setSeedPhrase] = useState('');

  // TODO: Validate seed phrase via WDK and restore wallet
  const isValid = seedPhrase.trim().split(/\s+/).length >= 12;

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.restoreWallet')}</Text>
        <Text style={styles.description}>
          Enter your 12 or 24 word seed phrase to restore your wallet.
        </Text>

        <TextInput
          style={styles.input}
          value={seedPhrase}
          onChangeText={setSeedPhrase}
          placeholder="Enter seed phrase..."
          placeholderTextColor={DfxColors.textTertiary}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />

        <PrimaryButton
          title={t('common.continue')}
          onPress={() => router.push('/(onboarding)/setup-pin')}
          disabled={!isValid}
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
  input: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    color: DfxColors.text,
    ...Typography.bodyLarge,
    textAlignVertical: 'top',
  },
});
