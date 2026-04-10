import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton, ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

type KycStep = 'email' | 'personal' | 'nationality' | 'financial' | 'ident' | 'complete';

const STEPS: KycStep[] = ['email', 'personal', 'nationality', 'financial', 'ident', 'complete'];

export default function KycScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<KycStep>('email');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = (stepIndex + 1) / STEPS.length;

  const goNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const goBack = () => {
    if (stepIndex === 0) {
      router.back();
    } else {
      setCurrentStep(STEPS[stepIndex - 1]);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'email':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Email Verification</Text>
            <Text style={styles.stepDescription}>
              Enter your email address to start the verification process.
            </Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={DfxColors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.spacer} />
            <PrimaryButton
              title="Continue"
              onPress={goNext}
              disabled={!email.includes('@')}
            />
          </View>
        );

      case 'personal':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Personal Data</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              placeholderTextColor={DfxColors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              placeholderTextColor={DfxColors.textTertiary}
            />
            <View style={styles.spacer} />
            <PrimaryButton
              title="Continue"
              onPress={goNext}
              disabled={!firstName || !lastName}
            />
          </View>
        );

      case 'nationality':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Nationality</Text>
            <Text style={styles.stepDescription}>Select your nationality and country of residence.</Text>
            {/* TODO: Country picker component */}
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>Country selector</Text>
            </View>
            <View style={styles.spacer} />
            <PrimaryButton title="Continue" onPress={goNext} />
          </View>
        );

      case 'financial':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Financial Information</Text>
            <Text style={styles.stepDescription}>
              Required for regulatory compliance. Your data is encrypted and secure.
            </Text>
            {/* TODO: Financial data form (source of funds, occupation, etc.) */}
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>Financial data form</Text>
            </View>
            <View style={styles.spacer} />
            <PrimaryButton title="Continue" onPress={goNext} />
          </View>
        );

      case 'ident':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Identity Verification</Text>
            <Text style={styles.stepDescription}>
              Upload a photo of your ID document and take a selfie to verify your identity.
            </Text>
            {/* TODO: ID upload + selfie via expo-camera */}
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>Document upload + selfie</Text>
            </View>
            <View style={styles.spacer} />
            <PrimaryButton title="Submit" onPress={goNext} />
          </View>
        );

      case 'complete':
        return (
          <View style={styles.stepContent}>
            <View style={styles.completeContainer}>
              <Text style={styles.completeIcon}>{'\u2705'}</Text>
              <Text style={styles.completeTitle}>Verification Submitted</Text>
              <Text style={styles.completeDescription}>
                Your identity verification is being reviewed. This usually takes a few minutes.
              </Text>
            </View>
            <View style={styles.spacer} />
            <PrimaryButton title="Done" onPress={() => router.back()} />
          </View>
        );
    }
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={goBack}>
            <Text style={styles.backButton}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.title}>KYC</Text>
          <Text style={styles.stepIndicator}>
            {stepIndex + 1}/{STEPS.length}
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {renderStep()}
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
  stepIndicator: {
    ...Typography.bodySmall,
    color: DfxColors.textTertiary,
    width: 32,
    textAlign: 'right',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: DfxColors.surfaceLight,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: DfxColors.primary,
  },
  stepContent: {
    flex: 1,
    gap: 16,
  },
  stepTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  stepDescription: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
  },
  input: {
    backgroundColor: DfxColors.surface,
    borderRadius: 12,
    padding: 16,
    color: DfxColors.text,
    ...Typography.bodyLarge,
  },
  placeholder: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...Typography.bodyMedium,
    color: DfxColors.textTertiary,
  },
  completeContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  completeIcon: {
    fontSize: 64,
  },
  completeTitle: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
  },
  completeDescription: {
    ...Typography.bodyLarge,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
});
