import { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AppHeader,
  DfxBackgroundScreen,
  GlassCard,
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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    <DfxBackgroundScreen contentStyle={styles.content} testID="legal-disclaimer-screen">
      {/* Consent gate: no back affordance and no swipe-back — the user must
          accept and continue via the "Weiter" button below. */}
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <AppHeader title={t('legal.title')} hideBack testID="legal-disclaimer" />
      <OnboardingStepIndicator current={3} />

      {/* Only the legal text scrolls. The accept-checkbox + continue button
          live in a fixed footer below so "Weiter" is always reachable no
          matter how long the disclaimer copy is. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard testID="legal-disclaimer-card">
          <Text style={styles.eyebrow}>{t('legal.intro')}</Text>
          <Text style={styles.paragraph}>{t('legal.bodyWallet')}</Text>
          <Text style={styles.paragraph}>{t('legal.bodyTransactions')}</Text>
          <Text style={styles.paragraph}>{t('legal.bodyKyc')}</Text>

          <View style={styles.links}>
            {LEGAL_LINKS.map((link) => (
              <GlassCard
                key={link.url}
                variant="quiet"
                contentStyle={styles.linkRow}
                onPress={() => void openLegalLink(link.url)}
              >
                <Text style={styles.link}>{t(link.labelKey)}</Text>
                <Text style={styles.linkArrow}>{'\u203A'}</Text>
              </GlassCard>
            ))}
          </View>
        </GlassCard>
      </ScrollView>

      <View style={styles.footer}>
        <GlassCard
          testID="legal-accept-checkbox"
          contentStyle={styles.checkboxRow}
          onPress={() => setAccepted(!accepted)}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Text style={styles.checkmark}>{'\u2713'}</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{t('legal.accept')}</Text>
        </GlassCard>

        <PrimaryButton
          testID="legal-continue-button"
          title={t('common.continue')}
          onPress={handleContinue}
          disabled={!accepted}
        />
      </View>
    </DfxBackgroundScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: 4,
      paddingBottom: 24,
    },
    scroll: {
      flex: 1,
      marginTop: 22,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    footer: {
      gap: 16,
      paddingTop: 16,
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
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
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
  });
