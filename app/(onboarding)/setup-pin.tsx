import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

export default function SetupPinScreen() {
  const router = useRouter();
  const { setPin, setOnboarded, setAuthenticated } = useAuthStore();
  const [pin, setPinValue] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    setError(false);
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPinValue(newPin);

    if (newPin.length === 6) {
      if (step === 'create') {
        setFirstPin(newPin);
        setPinValue('');
        setStep('confirm');
      } else if (newPin === firstPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        completeSetup(newPin);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setPinValue('');
      }
    }
  };

  const completeSetup = async (pinValue: string) => {
    await setPin(pinValue);
    setOnboarded(true);
    setAuthenticated(true);
    // Navigate to legal disclaimer before dashboard
    router.replace('/(onboarding)/legal-disclaimer');
  };

  const handleDelete = () => {
    setError(false);
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
        {error && <Text style={styles.error}>PINs do not match. Try again.</Text>}

        <View style={styles.dots}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled, error && styles.dotError]}
            />
          ))}
        </View>

        <View style={styles.numpad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => (
            <View key={key} style={styles.numpadKey}>
              {key !== '' && (
                <Text
                  style={styles.numpadText}
                  onPress={() => (key === 'del' ? handleDelete() : handleDigit(key))}
                >
                  {key === 'del' ? '\u232B' : key}
                </Text>
              )}
            </View>
          ))}
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
    width: 80,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadText: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
    fontSize: 28,
  },
});
