import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

type SetupError = 'mismatch' | 'save';

export default function SetupPinScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setPin, setOnboarded, setAuthenticated } = useAuthStore();
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
      await setOnboarded(true);
      setAuthenticated(true);
      router.replace('/(onboarding)/legal-disclaimer');
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
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>{step === 'create' ? 'Create PIN' : 'Confirm PIN'}</Text>
        <Text style={styles.description}>
          {step === 'create'
            ? 'Choose a 6-digit PIN to secure your wallet.'
            : 'Enter your PIN again to confirm.'}
        </Text>
        {error && (
          <Text style={styles.error}>
            {error === 'save' ? t('pin.saveError') : t('pin.mismatch')}
          </Text>
        )}

        <View style={styles.dots}>
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
                style={({ pressed }) => [styles.numpadKey, pressed && styles.numpadKeyPressed]}
                onPress={() => (key === 'del' ? handleDelete() : handleDigit(key))}
                android_ripple={{ color: DfxColors.surfaceLight, borderless: false, radius: 36 }}
                accessibilityRole="button"
                accessibilityLabel={key === 'del' ? 'Delete' : key}
              >
                <Text style={styles.numpadText}>{key === 'del' ? '\u232B' : key}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 48,
    gap: 24,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
  },
  description: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  error: {
    ...Typography.bodyMedium,
    color: DfxColors.error,
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
    borderColor: DfxColors.primary,
  },
  dotFilled: {
    backgroundColor: DfxColors.primary,
  },
  dotError: {
    borderColor: DfxColors.error,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    marginTop: 'auto',
  },
  numpadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadKeyPressed: {
    backgroundColor: DfxColors.surfaceLight,
  },
  numpadText: {
    color: DfxColors.text,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
