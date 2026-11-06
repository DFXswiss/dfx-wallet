import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { PrimaryButton } from '@/components';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store';
import { getPostPinDestination } from '@/store/auth';
import { Typography, useColors } from '@/theme';

/**
 * Stand-in for the PIN-unlock screen when `EXPO_PUBLIC_ENABLE_PIN` is
 * off. Unlocks the WDK wallet, flips `isAuthenticated` and continues
 * to the post-PIN destination.
 *
 * Without this, the auth-layout's "redirect to /(pin)/verify when
 * `isAuthenticated` is false" gate would never resolve: an MVP build
 * has no PIN to enter and no biometric module loaded, so the only way
 * out of the gate is to unlock the wallet and authenticate on mount.
 *
 * The wallet seed is already in secure storage, the WDK worklet
 * unlocks it from there. Unlocking is the gate: if it rejects, the
 * wallet is not usable, so nothing is authenticated and the user stays
 * here with a recovery path instead of being bounced to the dashboard.
 * A finish failure after a successful unlock retries only onboarding
 * and navigation. It does not unlock again.
 */
export default function VerifyPinDisabled() {
  const { replace } = useRouter();
  const { t } = useTranslation();
  const { setAuthenticated, setOnboarded } = useAuthStore();
  const { unlock } = useWalletManager();
  const colors = useColors();
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [finishError, setFinishError] = useState(false);
  const [processing, setProcessing] = useState(true);
  const cancelledRef = useRef(false);
  const unlockedRef = useRef(false);

  const goToRecovery = useCallback(() => {
    replace('/(onboarding)/restore-wallet');
  }, [replace]);

  const runFinishStep = useCallback(async () => {
    const destination = getPostPinDestination(useAuthStore.getState().isOnboarded, FEATURES.LEGAL);
    if (destination.shouldSetOnboarded) await setOnboarded(true);
    if (cancelledRef.current) return;
    setAuthenticated(true);
    replace(destination.route);
  }, [replace, setAuthenticated, setOnboarded]);

  const finish = useCallback(async () => {
    setUnlockFailed(false);
    setFinishError(false);
    setProcessing(true);
    try {
      if (!unlockedRef.current) {
        try {
          await unlock('default');
        } catch (err) {
          console.warn('verify-disabled: authentication failed', err);
          if (!cancelledRef.current) setUnlockFailed(true);
          return;
        }
        if (cancelledRef.current) return;
        unlockedRef.current = true;
      }
      await runFinishStep();
    } catch (err) {
      console.warn('verify-disabled: authentication failed', err);
      if (!cancelledRef.current) {
        setAuthenticated(false);
        setFinishError(true);
      }
    } finally {
      if (!cancelledRef.current) setProcessing(false);
    }
  }, [runFinishStep, setAuthenticated, unlock]);

  const retryFinish = useCallback(async () => {
    setFinishError(false);
    setProcessing(true);
    try {
      await runFinishStep();
    } catch (err) {
      console.warn('verify-disabled: authentication failed', err);
      if (!cancelledRef.current) {
        setAuthenticated(false);
        setFinishError(true);
      }
    } finally {
      if (!cancelledRef.current) setProcessing(false);
    }
  }, [runFinishStep, setAuthenticated]);

  useEffect(() => {
    cancelledRef.current = false;
    void finish();
    return () => {
      cancelledRef.current = true;
    };
  }, [finish]);

  if (processing) return null;

  if (unlockFailed) {
    return (
      <View style={styles.container} testID="verify-pin-disabled">
        <Text style={[styles.error, { color: colors.error }]} testID="verify-pin-unlock-error">
          {t('pin.unlockFailed')}
        </Text>
        <PrimaryButton
          testID="verify-pin-recovery-button"
          variant="outlined"
          title={t('pin.recoveryCta')}
          onPress={goToRecovery}
        />
      </View>
    );
  }

  if (!finishError) return null;

  return (
    <View style={styles.container} testID="verify-pin-disabled">
      <Text style={[styles.error, { color: colors.error }]} testID="verify-pin-finish-error">
        {t('pin.finishError')}
      </Text>
      <PrimaryButton
        testID="verify-pin-disabled-retry"
        title={t('common.retry')}
        onPress={() => void retryFinish()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  error: {
    ...Typography.bodyMedium,
    textAlign: 'center',
  },
});
