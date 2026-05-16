import { useMemo, useState } from 'react';
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
import { Typography, useColors, type ThemeColors } from '@/theme';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
              <Text style={styles.linkArrow}>{'›'}</Text>
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
          {accepted && <Text style={styles.checkmark}>{'✓'}</Text>}
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingTop: 4,
      paddingBottom: 24,
      gap: 22,
    },
    card: {
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    eyebrow: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 18,
    },
    paragraph: {
      ...Typography.bodyMedium,
      color: colors.text,
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
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    link: {
      ...Typography.bodyMedium,
      color: colors.primary,
      fontWeight: '600',
    },
    linkArrow: {
      ...Typography.headlineSmall,
      color: colors.primary,
    },
    pressed: {
      opacity: 0.7,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.cardOverlay,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
    checkboxLabel: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },
    spacer: {
      flex: 1,
    },
  });
