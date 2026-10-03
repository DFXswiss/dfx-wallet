import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import {
  BrandLogo,
  GlassPill,
  Icon,
  PinPad,
  PinProcessingOverlay,
  PrimaryButton,
  ScreenBackdrop,
} from '@/components';
import { needsPinRehash } from '@/services/pin';
import { useAuthStore } from '@/store';
import { Typography, useColors, type ThemeColors } from '@/theme';

const MAX_ATTEMPTS = 5;

/**
 * PIN-unlock screen for the cold-start path.
 *
 * Visual: the dashboard's mountain illustration is reused as the background
 * in light mode so the unlock surface feels continuous with the post-auth
 * experience. Dark mode swaps to a solid surface so the bright sky doesn't
 * fight the dark text.
 */
export default function VerifyPinScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { verifyPin, setAuthenticated, authenticateBiometric, biometricEnabled, pinHash } =
    useAuthStore();
  const { unlock } = useWalletManager();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState(false);
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [biometricInFlight, setBiometricInFlight] = useState(false);
  const [processing, setProcessing] = useState(false);

  const goToDashboard = useCallback(() => {
    router.replace('/(auth)/(tabs)/dashboard');
  }, [router]);

  const goToRecovery = useCallback(() => {
    router.replace('/(onboarding)/restore-wallet');
  }, [router]);

  const unlockWallet = useCallback(() => unlock('default'), [unlock]);

  const tryBiometric = useCallback(async () => {
    if (biometricInFlight) return;
    setBiometricInFlight(true);
    try {
      const success = await authenticateBiometric();
      if (!success) return;
      try {
        await unlockWallet();
      } catch (err) {
        console.warn('verify: biometric unlock failed', err);
        setUnlockFailed(true);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAuthenticated(true);
      goToDashboard();
    } catch (err) {
      console.warn('verify: biometric authentication failed', err);
    } finally {
      setBiometricInFlight(false);
    }
  }, [authenticateBiometric, biometricInFlight, goToDashboard, setAuthenticated, unlockWallet]);

  useEffect(() => {
    if (biometricEnabled) {
      void tryBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricEnabled]);

  const handleDigit = (digit: string) => {
    if (processing) return;
    setError(false);
    setUnlockFailed(false);
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPinValue(newPin);

    if (pinHash && needsPinRehash(pinHash) && newPin.length >= 4 && newPin.length < 6) {
      void checkPin(newPin, { showInvalid: false });
    }

    if (newPin.length === 6) {
      void checkPin(newPin, { showInvalid: true });
    }
  };

  const checkPin = async (pinValue: string, { showInvalid }: { showInvalid: boolean }) => {
    if (showInvalid) {
      setProcessing(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    let isValid = false;
    try {
      isValid = await verifyPin(pinValue);
    } catch (err) {
      console.warn('verify: PIN verification threw', err);
    }
    if (isValid) {
      try {
        await unlockWallet();
      } catch (err) {
        console.warn('verify: PIN unlock failed', err);
        if (showInvalid) setProcessing(false);
        setUnlockFailed(true);
        setPinValue('');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAuthenticated(true);
      goToDashboard();
      return;
    }
    if (!showInvalid) return;
    setProcessing(false);
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

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content} testID="verify-pin-screen">
        <BrandLogo size="auth" style={styles.logoWrap} />
        <Text style={styles.title}>{t('pin.enterTitle')}</Text>

        {isLocked ? (
          <Text style={styles.locked} testID="verify-pin-locked">
            {t('pin.tooMany')}
          </Text>
        ) : (
          <>
            {biometricEnabled && (
              <GlassPill
                testID="verify-pin-biometric-button"
                selected
                onPress={tryBiometric}
                disabled={biometricInFlight}
                style={styles.biometricPill}
                accessibilityRole="button"
                accessibilityLabel={t('pin.biometricCta')}
              >
                <View style={styles.biometricContent}>
                  <Icon name="user" size={18} color={colors.primary} />
                  <Text style={styles.biometricText}>{t('pin.biometricCta')}</Text>
                </View>
              </GlassPill>
            )}

            {unlockFailed && (
              <>
                <Text style={styles.error} testID="verify-pin-unlock-error">
                  {t('pin.unlockFailed')}
                </Text>
                <PrimaryButton
                  testID="verify-pin-recovery-button"
                  variant="outlined"
                  title={t('pin.recoveryCta')}
                  onPress={goToRecovery}
                />
              </>
            )}

            {error && !unlockFailed && (
              <Text style={styles.error} testID="verify-pin-error">
                {t('pin.incorrectAttemptsLeft', { count: MAX_ATTEMPTS - attempts })}
              </Text>
            )}

            <PinPad
              value={pin}
              error={error}
              disabled={isLocked}
              onDigit={handleDigit}
              onDelete={handleDelete}
              dotsTestID="verify-pin-dots"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );

  return (
    <View style={styles.bg}>
      <ScreenBackdrop variant="pin" />
      {body}
      {processing && <PinProcessingOverlay />}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 40,
      paddingBottom: 32,
      gap: 18,
    },
    logoWrap: {
      marginBottom: 8,
    },
    title: {
      ...Typography.headlineMedium,
      color: colors.text,
    },
    error: {
      ...Typography.bodyMedium,
      color: colors.error,
      textAlign: 'center',
    },
    locked: {
      ...Typography.bodyLarge,
      color: colors.error,
      textAlign: 'center',
      paddingHorizontal: 32,
      marginTop: 48,
    },
    biometricPill: {
      alignSelf: 'center',
    },
    biometricContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    biometricText: {
      ...Typography.bodyMedium,
      color: colors.primary,
      fontWeight: '700',
    },
  });
