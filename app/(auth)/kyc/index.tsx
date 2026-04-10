import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton, ScreenContainer } from '@/components';
import { useKycFlow } from '@/hooks';
import type { KycStepDto } from '@/services/dfx/dto';
import { DfxColors, Typography } from '@/theme';

const STEP_LABELS: Record<string, string> = {
  ContactData: 'Contact',
  PersonalData: 'Personal Data',
  NationalityData: 'Nationality',
  FinancialData: 'Financial Info',
  Ident: 'Identity Check',
};

const STATUS_COLORS: Record<string, string> = {
  Completed: DfxColors.success,
  InProgress: DfxColors.warning,
  InReview: DfxColors.info,
  Failed: DfxColors.error,
  NotStarted: DfxColors.textTertiary,
};

export default function KycScreen() {
  const router = useRouter();
  const {
    kycLevel,
    currentSession,
    isLoading,
    error,
    loadKycStatus,
    continueKyc,
    submitContactData,
    submitPersonalData,
  } = useKycFlow();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    loadKycStatus();
  }, [loadKycStatus]);

  const handleContinue = async () => {
    const session = await continueKyc();
    if (session?.currentStep?.session) {
      const { type, url } = session.currentStep.session;
      if (type === 'Browser') {
        await Linking.openURL(url);
      }
    }
  };

  const handleSubmitStep = async () => {
    const step = currentSession?.currentStep;
    if (!step) return;

    let success = false;
    if (step.name === 'ContactData') {
      success = await submitContactData(step.sequenceNumber, email);
    } else if (step.name === 'PersonalData') {
      success = await submitPersonalData(step.sequenceNumber, { firstName, lastName });
    }

    if (success) {
      await continueKyc();
    }
  };

  if (isLoading && !kycLevel) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DfxColors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const steps = kycLevel?.kycSteps ?? [];
  const currentStep = currentSession?.currentStep;

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>KYC Verification</Text>
          <View style={styles.backButton} />
        </View>

        {/* KYC Level */}
        <View style={styles.levelCard}>
          <Text style={styles.levelLabel}>Current Level</Text>
          <Text style={styles.levelValue}>{kycLevel?.kycLevel ?? 0}</Text>
        </View>

        {/* Steps overview */}
        <View style={styles.stepsContainer}>
          {steps.map((step) => (
            <View key={step.name} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: STATUS_COLORS[step.status] ?? DfxColors.textTertiary },
                ]}
              />
              <Text style={styles.stepName}>
                {STEP_LABELS[step.name] ?? step.name}
              </Text>
              <Text style={styles.stepStatus}>{step.status}</Text>
            </View>
          ))}
        </View>

        {/* Current step form */}
        {currentStep?.session?.type === 'API' && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {STEP_LABELS[currentStep.name] ?? currentStep.name}
            </Text>

            {currentStep.name === 'ContactData' && (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={DfxColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}

            {currentStep.name === 'PersonalData' && (
              <>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={DfxColors.textTertiary}
                />
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={DfxColors.textTertiary}
                />
              </>
            )}

            <PrimaryButton title="Submit" onPress={handleSubmitStep} loading={isLoading} />
          </View>
        )}

        {currentStep?.session?.type === 'Browser' && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {STEP_LABELS[currentStep.name] ?? currentStep.name}
            </Text>
            <Text style={styles.formDescription}>
              This step requires identity verification in your browser.
            </Text>
            <PrimaryButton
              title="Open Verification"
              onPress={() => Linking.openURL(currentStep.session!.url)}
            />
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {!currentStep && steps.length > 0 && (
          <PrimaryButton
            title="Continue Verification"
            onPress={handleContinue}
            loading={isLoading}
          />
        )}

        {steps.every((s) => s.status === 'Completed') && (
          <View style={styles.completeContainer}>
            <Text style={styles.completeIcon}>{'\u2705'}</Text>
            <Text style={styles.completeText}>KYC verification complete</Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 24,
    color: DfxColors.text,
    width: 32,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelCard: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  levelLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelValue: {
    ...Typography.headlineLarge,
    color: DfxColors.primary,
  },
  stepsContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepName: {
    ...Typography.bodyMedium,
    color: DfxColors.text,
    flex: 1,
  },
  stepStatus: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
  },
  formContainer: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  formTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  formDescription: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  input: {
    backgroundColor: DfxColors.surfaceLight,
    borderRadius: 12,
    padding: 16,
    color: DfxColors.text,
    ...Typography.bodyLarge,
  },
  errorText: {
    ...Typography.bodySmall,
    color: DfxColors.error,
    textAlign: 'center',
  },
  completeContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  completeIcon: {
    fontSize: 48,
  },
  completeText: {
    ...Typography.bodyLarge,
    color: DfxColors.success,
    fontWeight: '600',
  },
});
