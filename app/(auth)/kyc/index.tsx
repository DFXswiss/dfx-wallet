import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

export default function KycScreen() {
  // TODO: Port KYC multi-step flow from RealUnit
  // Steps: Registration → Email → Nationality → Financial Data → 2FA → Ident
  // Mirrors: screens/kyc/ (steps/, cubits/)

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <Text style={styles.title}>KYC Verification</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Multi-step KYC flow (registration, email, nationality, financial data, 2FA, ident)
          </Text>
        </View>
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
  placeholder: {
    flex: 1,
    padding: 32,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
    textAlign: 'center',
  },
});
