import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

export default function SetupPinScreen() {
  const router = useRouter();
  const { setPin, setOnboarded } = useAuthStore();
  const [pin, setPinValue] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');

  const handleDigit = (digit: string) => {
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPinValue(newPin);

    if (newPin.length === 6) {
      if (step === 'create') {
        setFirstPin(newPin);
        setPinValue('');
        setStep('confirm');
      } else if (newPin === firstPin) {
        setPin(newPin);
        setOnboarded(true);
        router.replace('/(auth)/(tabs)/dashboard');
      } else {
        setPinValue('');
      }
    }
  };

  const handleDelete = () => {
    setPinValue(pin.slice(0, -1));
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>
          {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
        </Text>
        <Text style={styles.description}>
          {step === 'create'
            ? 'Choose a 6-digit PIN to secure your wallet.'
            : 'Enter your PIN again to confirm.'}
        </Text>

        <View style={styles.dots}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
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
