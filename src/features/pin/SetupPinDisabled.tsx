import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FEATURES } from '@/config/features';
import { useAuthStore } from '@/store';
import { Typography, useColors } from '@/theme';

/**
 * Stand-in for the PIN-setup step when `EXPO_PUBLIC_ENABLE_PIN` is
 * off. Authenticates the in-memory wallet and either opens the legal
 * consent gate or completes onboarding and routes to the dashboard.
 *
 * Without this, the onboarding flow would hand off to a `<Redirect>`
 * back to the welcome screen and the user would loop. The MVP build
 * has no PIN gate so there is nothing to authenticate against — the
 * wallet is unlocked the moment the seed is in WDK.
 *
 * Pulls only the auth store; no `hashPin`, no `secureStore` writes
 * beyond the onboarded flag, no biometric module.
 */
export default function SetupPinDisabled() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const { setOnboarded, setAuthenticated } = useAuthStore();
  const [finishError, setFinishError] = useState(false);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!FEATURES.LEGAL) await setOnboarded(true);
        if (cancelled) return;
        setAuthenticated(true);
        router.replace(
          FEATURES.LEGAL ? '/(onboarding)/legal-disclaimer' : '/(auth)/(tabs)/dashboard',
        );
      } catch (err) {
        console.warn('setup-pin-disabled: failed to finish authentication', err);
        if (!cancelled) {
          setAuthenticated(false);
          setFinishError(true);
        }
      } finally {
        if (!cancelled) setProcessing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setOnboarded, setAuthenticated]);

  if (processing || !finishError) return null;

  return (
    <View style={styles.container} testID="setup-pin-disabled-error">
      <Text style={[styles.error, { color: colors.error }]}>{t('pin.finishError')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  error: {
    ...Typography.bodyMedium,
    textAlign: 'center',
  },
});
