import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { BrandLogo, DfxBackgroundScreen, OnboardingStepIndicator, PinPad } from '@/components';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store';
import { Typography, useColors, type ThemeColors } from '@/theme';

type SetupError = 'mismatch' | 'save';

export default function SetupPinScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();
  const { setPin, setAuthenticated } = useAuthStore();
  const [pin, setPinValue] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<SetupError | null>(null);

  const handleDigit = (digit: string) => {
    setError(null);
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPinValue(newPin);

    if (newPin.length === 6) {
      if (step === 'create') {
        setFirstPin(newPin);
        setPinValue('');
        setStep('confirm');
      } else if (newPin === firstPin) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void completeSetup(newPin);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError('mismatch');
        setPinValue('');
      }
    }
  };

  const completeSetup = async (pinValue: string) => {
    try {
      await setPin(pinValue);
      setAuthenticated(true);
      // With `EXPO_PUBLIC_ENABLE_LEGAL` off, the disclaimer step is
      // not part of the onboarding flow; skip straight to the
      // dashboard so the user does not bounce through a redirect stub.
      router.replace(
        FEATURES.LEGAL ? '/(onboarding)/legal-disclaimer' : '/(auth)/(tabs)/dashboard',
      );
    } catch (err) {
      console.warn('setup-pin: failed to persist PIN', err);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('save');
      setPinValue('');
      setFirstPin('');
      setStep('create');
    }
  };

  const handleDelete = () => {
    setError(null);
    setPinValue(pin.slice(0, -1));
  };

  return (
    <DfxBackgroundScreen
      backdropVariant="pin"
      contentStyle={styles.content}
      testID={step === 'create' ? 'setup-pin-screen' : 'setup-pin-confirm-screen'}
    >
      <BrandLogo size="auth" style={styles.logo} />
      <OnboardingStepIndicator current={2} />
      <Text style={styles.title}>{step === 'create' ? t('pin.create') : t('pin.confirm')}</Text>
      <Text style={styles.description}>
        {step === 'create' ? t('pin.createDescription') : t('pin.confirmDescription')}
      </Text>
      {error && (
        <Text style={styles.error} testID="setup-pin-error">
          {error === 'save' ? t('pin.saveError') : t('pin.mismatch')}
        </Text>
      )}

      <PinPad
        value={pin}
        error={error !== null}
        onDigit={handleDigit}
        onDelete={handleDelete}
        dotsTestID="setup-pin-dots"
      />
    </DfxBackgroundScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 18,
    },
    logo: {
      marginBottom: 8,
    },
    title: {
      ...Typography.headlineMedium,
      color: colors.text,
    },
    description: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    error: {
      ...Typography.bodyMedium,
      color: colors.error,
    },
  });
