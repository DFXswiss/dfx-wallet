import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenContainer } from '@/components';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

const MAX_ATTEMPTS = 5;

export default function VerifyPinScreen() {
  const router = useRouter();
  const { verifyPin, setAuthenticated, authenticateBiometric, biometricEnabled } = useAuthStore();
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const tryBiometric = useCallback(async () => {
    const success = await authenticateBiometric();
    if (success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAuthenticated(true);
      router.replace('/(auth)/(tabs)/dashboard');
    }
  }, [authenticateBiometric, setAuthenticated, router]);

  // Try biometric on mount
  useEffect(() => {
    if (biometricEnabled) {
      void tryBiometric();
    }
  }, [biometricEnabled, tryBiometric]);

  const handleDigit = (digit: string) => {
    setError(false);
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPinValue(newPin);

    if (newPin.length === 6) {
      void checkPin(newPin);
    }
  };

  const checkPin = async (pinValue: string) => {
    const isValid = await verifyPin(pinValue);
    if (isValid) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAuthenticated(true);
      router.replace('/(auth)/(tabs)/dashboard');
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      setAttempts((a) => a + 1);
      setPinValue('');
    }
  };

  const handleDelete = () => {
    setError(false);
    setPinValue(pin.slice(0, -1));
  };

  const isLocked = attempts >= MAX_ATTEMPTS;

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Enter PIN</Text>

        {isLocked ? (
          <Text style={styles.locked}>Too many failed attempts. Please restart the app.</Text>
        ) : (
          <>
            {error && (
              <Text style={styles.error}>
                Incorrect PIN. {MAX_ATTEMPTS - attempts} attempts remaining.
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
                    disabled={isLocked}
                    onPress={() => (key === 'del' ? handleDelete() : handleDigit(key))}
                    android_ripple={{
                      color: DfxColors.surfaceLight,
                      borderless: false,
                      radius: 36,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={key === 'del' ? 'Delete' : key}
                  >
                    <Text style={styles.numpadText}>{key === 'del' ? '\u232B' : key}</Text>
                  </Pressable>
                );
              })}
            </View>

            {biometricEnabled && (
              <Pressable style={styles.biometricButton} onPress={tryBiometric}>
                <Text style={styles.biometricText}>Use Biometric</Text>
              </Pressable>
            )}
          </>
        )}
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
    textAlign: 'center',
  },
  locked: {
    ...Typography.bodyLarge,
    color: DfxColors.error,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 48,
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
  biometricButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  biometricText: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '600',
  },
});
