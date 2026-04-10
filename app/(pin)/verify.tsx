import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

export default function VerifyPinScreen() {
  const router = useRouter();
  const { pin: storedPin, setAuthenticated } = useAuthStore();
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    setError(false);
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPinValue(newPin);

    if (newPin.length === 6) {
      if (newPin === storedPin) {
        setAuthenticated(true);
        router.replace('/(auth)/(tabs)/dashboard');
      } else {
        setError(true);
        setPinValue('');
      }
    }
  };

  const handleDelete = () => {
    setError(false);
    setPinValue(pin.slice(0, -1));
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Enter PIN</Text>
        {error && <Text style={styles.error}>Incorrect PIN. Try again.</Text>}

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
