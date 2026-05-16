import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { BrandLogo, DfxBackgroundScreen, OnboardingStepIndicator } from '@/components';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store';
import { Typography, useColors, type ThemeColors } from '@/theme';

type SetupError = 'mismatch' | 'save';

export default function SetupPinScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setPin, setAuthenticated } = useAuthStore();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      contentStyle={styles.content}
      testID={step === 'create' ? 'setup-pin-screen' : 'setup-pin-confirm-screen'}
    >
      <BrandLogo size="auth" style={styles.logoWrap} />
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

      <View style={styles.dots} testID="setup-pin-dots">
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled, error && styles.dotError]}
          />
        ))}
      </View>

      <View style={styles.numpad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
          if (key === '') {
            return <View key={key} style={styles.numpadKey} />;
          }
          return (
            <Pressable
              key={key}
              testID={key === 'del' ? 'pin-key-delete' : `pin-key-${key}`}
              style={({ pressed }) => [styles.numpadKey, pressed && styles.numpadKeyPressed]}
              onPress={() => (key === 'del' ? handleDelete() : handleDigit(key))}
              android_ripple={{ color: colors.surfaceLight, borderless: false, radius: 36 }}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete' : key}
            >
              <Text style={styles.numpadText}>{key === 'del' ? '⌫' : key}</Text>
            </Pressable>
          );
        })}
      </View>
    </DfxBackgroundScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 32,
      paddingBottom: 32,
      gap: 16,
    },
    logoWrap: {
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
    dots: {
      flexDirection: 'row',
      gap: 16,
      marginVertical: 32,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    dotFilled: {
      backgroundColor: colors.primary,
    },
    dotError: {
      borderColor: colors.error,
    },
    numpad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      width: 280,
      marginTop: 24,
    },
    numpadKey: {
      width: 72,
      height: 72,
      borderRadius: 36,
      margin: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Brand-coloured pressed state — see VerifyPinScreenImpl for rationale.
    numpadKeyPressed: {
      backgroundColor: colors.primaryLight,
    },
    numpadText: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 32,
      textAlign: 'center',
      includeFontPadding: false,
    },
  });
