import { useCallback, useEffect, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWalletManager, useWdkApp } from '@tetherto/wdk-react-native-core';
import { Icon } from '@/components';
import { useAuthStore } from '@/store';
import { DfxColors, Typography } from '@/theme';

const MAX_ATTEMPTS = 5;

/**
 * PIN-unlock screen for the cold-start path.
 *
 * Visual: the dashboard's mountain illustration is reused as the background
 * so the unlock surface feels continuous with the post-auth experience
 * instead of dropping the user onto a flat slate. Important once linked
 * DFX wallets surface on the dashboard — entry to that screen should feel
 * like "the same wallet" rather than a separate gate.
 *
 * Biometric: auto-prompts Face ID / Touch ID on mount when the user opted
 * in during onboarding (`biometricEnabled`). A dedicated face-id pill at
 * the top of the action area is the primary affordance — the digit pad
 * is the fallback, not the other way around. Mirrors the realunit-app
 * unlock heuristic where the system prompt is the default path.
 */
export default function VerifyPinScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { verifyPin, setAuthenticated, authenticateBiometric, biometricEnabled } = useAuthStore();
  const { unlock } = useWalletManager();
  const { state } = useWdkApp();
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [biometricInFlight, setBiometricInFlight] = useState(false);

  const goToDashboard = useCallback(() => {
    router.replace('/(auth)/(tabs)/dashboard');
  }, [router]);

  const unlockWallet = useCallback(async () => {
    try {
      await unlock('default');
    } catch {
      // WdkAppProvider exposes the error; user can retry from settings.
    }
  }, [unlock]);

  const tryBiometric = useCallback(async () => {
    if (biometricInFlight) return;
    setBiometricInFlight(true);
    try {
      const success = await authenticateBiometric();
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAuthenticated(true);
        await unlockWallet();
      }
    } catch (err) {
      console.warn('verify: biometric authentication failed', err);
    } finally {
      setBiometricInFlight(false);
    }
  }, [authenticateBiometric, biometricInFlight, setAuthenticated, unlockWallet]);

  useEffect(() => {
    if (biometricEnabled) {
      void tryBiometric();
    }
    // Auto-prompt runs once per mount — the user can re-trigger via the
    // Face ID pill if they cancel the system sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricEnabled]);

  useEffect(() => {
    if (state.status === 'READY') {
      goToDashboard();
    }
  }, [state.status, goToDashboard]);

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
    try {
      const isValid = await verifyPin(pinValue);
      if (isValid) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAuthenticated(true);
        await unlockWallet();
        return;
      }
    } catch (err) {
      console.warn('verify: PIN verification threw', err);
      // Fall through so the user sees the wrong-PIN feedback instead of
      // a silent crash.
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(true);
    setAttempts((a) => a + 1);
    setPinValue('');
  };

  const handleDelete = () => {
    setError(false);
    setPinValue(pin.slice(0, -1));
  };

  const isLocked = attempts >= MAX_ATTEMPTS;

  return (
    <ImageBackground
      source={require('../../assets/dashboard-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content} testID="verify-pin-screen">
          <Text style={styles.title}>{t('pin.enterTitle')}</Text>

          {isLocked ? (
            <Text style={styles.locked} testID="verify-pin-locked">
              {t('pin.tooMany')}
            </Text>
          ) : (
            <>
              {biometricEnabled && (
                <Pressable
                  testID="verify-pin-biometric-button"
                  style={({ pressed }) => [styles.biometricPill, pressed && styles.pressed]}
                  onPress={tryBiometric}
                  disabled={biometricInFlight}
                  accessibilityRole="button"
                  accessibilityLabel={t('pin.biometricCta')}
                >
                  <Icon name="user" size={18} color={DfxColors.primary} />
                  <Text style={styles.biometricText}>{t('pin.biometricCta')}</Text>
                </Pressable>
              )}

              {error && (
                <Text style={styles.error} testID="verify-pin-error">
                  {t('pin.incorrectAttemptsLeft', { count: MAX_ATTEMPTS - attempts })}
                </Text>
              )}

              <View style={styles.dots} testID="verify-pin-dots">
                {Array.from({ length: 6 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i < pin.length && styles.dotFilled,
                      error && styles.dotError,
                    ]}
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
                      style={({ pressed }) => [
                        styles.numpadKey,
                        pressed && styles.numpadKeyPressed,
                      ]}
                      disabled={isLocked}
                      onPress={() => (key === 'del' ? handleDelete() : handleDigit(key))}
                      android_ripple={{
                        color: 'rgba(11, 20, 38, 0.08)',
                        borderless: false,
                        radius: 36,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={key === 'del' ? 'Delete' : key}
                    >
                      <Text style={styles.numpadText}>{key === 'del' ? '⌫' : key}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: DfxColors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 48,
    gap: 20,
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
  biometricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: DfxColors.primaryLight,
  },
  pressed: {
    opacity: 0.7,
  },
  biometricText: {
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 24,
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
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  numpadKeyPressed: {
    backgroundColor: 'rgba(11, 20, 38, 0.08)',
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
