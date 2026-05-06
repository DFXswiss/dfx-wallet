import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton, ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

const LEGAL_LINKS = [
  { label: 'Terms of Service', url: 'https://docs.dfx.swiss/en/tnc.html' },
  { label: 'Privacy Policy', url: 'https://docs.dfx.swiss/en/privacy.html' },
  { label: 'Disclaimer', url: 'https://docs.dfx.swiss/en/disclaimer.html' },
];

export default function LegalDisclaimerScreen() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  return (
    <ScreenContainer>
      <View style={styles.content} testID="legal-disclaimer-screen">
        <Text style={styles.title}>Legal Information</Text>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.paragraph}>
            DFX AG is a Swiss company regulated by VQF (self-regulatory organization recognized by
            FINMA). By using this app, you agree to the following terms and conditions.
          </Text>

          <Text style={styles.paragraph}>
            DFX Wallet is a non-custodial wallet. You are solely responsible for securing your seed
            phrase and PIN. DFX AG has no access to your private keys and cannot recover your wallet
            if you lose your seed phrase.
          </Text>

          <Text style={styles.paragraph}>
            Cryptocurrency transactions are irreversible. Please ensure all transaction details are
            correct before confirming. DFX AG is not responsible for losses due to user error,
            including sending assets to incorrect addresses.
          </Text>

          <Text style={styles.paragraph}>
            KYC (Know Your Customer) verification is required for certain transaction limits as
            mandated by Swiss anti-money laundering regulations.
          </Text>

          <View style={styles.links}>
            {LEGAL_LINKS.map((link) => (
              <Pressable key={link.url} onPress={() => Linking.openURL(link.url)}>
                <Text style={styles.link}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Pressable
          testID="legal-accept-checkbox"
          style={styles.checkboxRow}
          onPress={() => setAccepted(!accepted)}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Text style={styles.checkmark}>{'\u2713'}</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read and agree to the Terms of Service, Privacy Policy, and Disclaimer.
          </Text>
        </Pressable>

        <PrimaryButton
          testID="legal-continue-button"
          title="Continue"
          onPress={() => router.replace('/(auth)/(tabs)/dashboard')}
          disabled={!accepted}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 24,
    gap: 20,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
  },
  scrollContent: {
    flex: 1,
  },
  paragraph: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  links: {
    gap: 12,
    marginTop: 8,
  },
  link: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
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
});
