import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
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
import { FEATURES } from '@/config/features';
import { needsPinRehash } from '@/services/pin';
import { useAuthStore } from '@/store';
import { FIRST_LOCKOUT_ATTEMPT, getPostPinDestination } from '@/store/auth';
import { Typography, useColors, type ThemeColors } from '@/theme';

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
  const {
    verifyPin,
    setAuthenticated,
    authenticateBiometric,
    biometricEnabled,
    failedAttempts,
    pinHash,
    lockedUntil,
    isOnboarded,
    setOnboarded,
  } = useAuthStore();
  const { unlock } = useWalletManager();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState<'finish' | 'incorrect' | null>(null);
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [biometricInFlight, setBiometricInFlight] = useState(false);
  const [processing, setProcessing] = useState(false);
  const unlockedRef = useRef(false);
  const isLocked = lockedUntil !== null && lockedUntil > now;
  const isLegacyPin = pinHash !== null && needsPinRehash(pinHash);
  const remainingSeconds = isLocked ? Math.max(1, Math.ceil((lockedUntil - now) / 1000)) : 0;

  const finishAuthentication = useCallback(async () => {
    try {
      const destination = getPostPinDestination(isOnboarded, FEATURES.LEGAL);
      if (destination.shouldSetOnboarded) await setOnboarded(true);
      setAuthenticated(true);
      router.replace(destination.route);
    } catch (err) {
      console.warn('verify: failed to finish authentication', err);
      unlockedRef.current = false;
      setAuthenticated(false);
      setError('finish');
      setPinValue('');
    } finally {
      setProcessing(false);
    }
  }, [isOnboarded, router, setAuthenticated, setOnboarded]);

  const goToRecovery = useCallback(() => {
    router.replace('/(onboarding)/restore-wallet');
  }, [router]);

  const unlockWallet = useCallback(() => unlock('default'), [unlock]);

  const tryBiometric = useCallback(async () => {
    if (lockedUntil !== null && lockedUntil > Date.now()) return;
    if (biometricInFlight) return;
    setBiometricInFlight(true);
    try {
      const success = await authenticateBiometric({
        promptMessage: t('biometric.prompt'),
        cancelLabel: t('biometric.usePin'),
      });
      if (!success) return;
      // Re-read: lockedUntil from this closure is stale once the prompt resolves.
      const lockedUntilNow = useAuthStore.getState().lockedUntil;
      if (lockedUntilNow !== null && lockedUntilNow > Date.now()) return;
      try {
        await unlockWallet();
      } catch (err) {
        console.warn('verify: biometric unlock failed', err);
        setUnlockFailed(true);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await finishAuthentication();
    } catch (err) {
      console.warn('verify: biometric authentication failed', err);
    } finally {
      setBiometricInFlight(false);
    }
  }, [
    authenticateBiometric,
    biometricInFlight,
    finishAuthentication,
    lockedUntil,
    t,
    unlockWallet,
  ]);

  useEffect(() => {
    if (biometricEnabled && !(lockedUntil !== null && lockedUntil > Date.now())) {
      void tryBiometric();
    }
    // The lock timestamp does not change when the window merely expires, so
    // this does not prompt again on its own once the lockout ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricEnabled, lockedUntil]);

  const handleDigit = (digit: string) => {
    if (unlockedRef.current || processing || isLocked) return;
    setError(null);
    setUnlockFailed(false);
    const newPin = pin + digit;
    if (newPin.length > 6) return;
    setPinValue(newPin);

    if (newPin.length === 6) {
      void checkPin(newPin);
    }
  };

  const checkPin = async (pinValue: string) => {
    if (unlockedRef.current) return;
    setProcessing(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (unlockedRef.current) return;

    let isValid = false;
    try {
      isValid = await verifyPin(pinValue);
    } catch (err) {
      console.warn('verify: PIN verification threw', err);
    }
    if (unlockedRef.current) return;
    if (isValid) {
      unlockedRef.current = true;
      try {
        await unlockWallet();
      } catch (err) {
        console.warn('verify: PIN unlock failed', err);
        unlockedRef.current = false;
        setProcessing(false);
        setUnlockFailed(true);
        setPinValue('');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await finishAuthentication();
      return;
    }
    setProcessing(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError('incorrect');
    setPinValue('');
  };

  const handleSubmit = () => {
    if (unlockedRef.current || processing || isLocked || !isLegacyPin || pin.length < 4) return;
    void checkPin(pin);
  };

  const handleDelete = () => {
    if (isLocked) return;
    setError(null);
    setPinValue(pin.slice(0, -1));
  };

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  const getPinErrorMessage = () => {
    if (error === 'finish') return t('pin.finishError');
    if (failedAttempts < FIRST_LOCKOUT_ATTEMPT) {
      return t('pin.incorrectAttemptsLeft', {
        count: FIRST_LOCKOUT_ATTEMPT - failedAttempts,
      });
    }
    return t('pin.tooMany');
  };

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content} testID="verify-pin-screen">
        <BrandLogo size="auth" style={styles.logoWrap} />
        <Text style={styles.title}>{t('pin.enterTitle')}</Text>

        {isLocked && (
          <Text style={styles.locked} testID="verify-pin-locked">
            {t('pin.lockedFor', { count: remainingSeconds })}
          </Text>
        )}

        {!isLocked && biometricEnabled && (
          <GlassPill
            testID="verify-pin-biometric-button"
            selected
            onPress={() => void tryBiometric()}
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

        {!isLocked && unlockFailed && (
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

        {!isLocked && error && !unlockFailed && (
          <Text style={styles.error} testID="verify-pin-error">
            {getPinErrorMessage()}
          </Text>
        )}

        <PinPad
          value={pin}
          error={error !== null}
          disabled={isLocked}
          onDigit={handleDigit}
          onDelete={handleDelete}
          dotsTestID="verify-pin-dots"
        />

        {isLegacyPin && (
          <PrimaryButton
            testID="verify-pin-submit"
            title={t('common.confirm')}
            onPress={handleSubmit}
            disabled={pin.length < 4 || processing || isLocked}
          />
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
