import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AppHeader,
  DfxBackgroundScreen,
  OnboardingStepIndicator,
  PrimaryButton,
} from '@/components';
import { isAllowedDfxHost } from '@/services/security/safe-url';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

const LEGAL_LINKS = [
  { labelKey: 'legal.terms', url: 'https://docs.dfx.swiss/de/tnc.html' },
  { labelKey: 'legal.privacy', url: 'https://docs.dfx.swiss/de/privacy-policy.html' },
  { labelKey: 'legal.disclaimer', url: 'https://docs.dfx.swiss/de/disclaimer.html' },
];

export default function LegalDisclaimerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setAuthenticated, setOnboarded } = useAuthStore();
  const [accepted, setAccepted] = useState(false);

  const openLegalLink = async (url: string) => {
    if (!isAllowedDfxHost(url)) return;
    await Linking.openURL(url);
  };

  const handleContinue = async () => {
    await setOnboarded(true);
    setAuthenticated(true);
    router.replace('/(auth)/(tabs)/dashboard');
  };

  return (
    <DfxBackgroundScreen scrollable contentStyle={styles.content} testID="legal-disclaimer-screen">
      <AppHeader title={t('legal.title')} testID="legal-disclaimer" />
      <OnboardingStepIndicator current={3} />

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('legal.intro')}</Text>
        <Text style={styles.paragraph}>{t('legal.bodyWallet')}</Text>
        <Text style={styles.paragraph}>{t('legal.bodyTransactions')}</Text>
        <Text style={styles.paragraph}>{t('legal.bodyKyc')}</Text>

        <View style={styles.links}>
          {LEGAL_LINKS.map((link) => (
            <Pressable
              key={link.url}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
              onPress={() => void openLegalLink(link.url)}
            >
              <Text style={styles.link}>{t(link.labelKey)}</Text>
              <Text style={styles.linkArrow}>{'\u203A'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        testID="legal-accept-checkbox"
        style={styles.checkboxRow}
        onPress={() => setAccepted(!accepted)}
      >
        <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
          {accepted && <Text style={styles.checkmark}>{'\u2713'}</Text>}
        </View>
        <Text style={styles.checkboxLabel}>{t('legal.accept')}</Text>
      </Pressable>

      <View style={styles.spacer} />

      <PrimaryButton
        testID="legal-continue-button"
        title={t('common.continue')}
        onPress={handleContinue}
        disabled={!accepted}
      />
    </DfxBackgroundScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 4,
    paddingBottom: 24,
    gap: 22,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 18,
  },
  eyebrow: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 22,
    marginBottom: 18,
  },
  paragraph: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    lineHeight: 22,
    marginBottom: 14,
  },
  links: {
    gap: 8,
    marginTop: 4,
  },
  linkRow: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: DfxColors.surfaceLight,
    borderWidth: 1,
    borderColor: DfxColors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '600',
  },
  linkArrow: {
    ...Typography.headlineSmall,
    color: DfxColors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DfxColors.border,
    padding: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: DfxColors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: DfxColors.primary,
    borderColor: DfxColors.primary,
  },
  checkmark: {
    color: DfxColors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  spacer: {
    flex: 1,
  },
});
