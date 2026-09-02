import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWalletManager } from '@tetherto/wdk-react-native-core';
import { PrimaryButton } from '@/components';
import { useAuthStore } from '@/store';
import { Typography, useColors } from '@/theme';

/**
 * Stand-in for the PIN-unlock screen when `EXPO_PUBLIC_ENABLE_PIN` is
 * off. Unlocks the WDK wallet, flips `isAuthenticated` and bounces
 * back to the dashboard.
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
 */
export default function VerifyPinDisabled() {
  const { replace } = useRouter();
  const { t } = useTranslation();
  const { setAuthenticated } = useAuthStore();
  const { unlock } = useWalletManager();
  const colors = useColors();
  const [unlockFailed, setUnlockFailed] = useState(false);

  const goToRecovery = useCallback(() => {
    replace('/(onboarding)/restore-wallet');
  }, [replace]);

  useEffect(() => {
    if (unlockFailed) return;
    let cancelled = false;
    void (async () => {
      try {
        await unlock('default');
      } catch (err) {
        console.warn('verify-disabled: wallet unlock failed', err);
        if (!cancelled) setUnlockFailed(true);
        return;
      }
      if (cancelled) return;
      setAuthenticated(true);
      replace('/(auth)/(tabs)/dashboard');
    })();
    return () => {
      cancelled = true;
    };
  }, [replace, setAuthenticated, unlock, unlockFailed]);

  if (!unlockFailed) return null;

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
