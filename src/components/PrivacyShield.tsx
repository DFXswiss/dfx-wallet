import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View, type AppStateStatus } from 'react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { useColors } from '@/theme';

type AppSwitcherProtectionApi = {
  enableAppSwitcherProtectionAsync: (blurIntensity?: number) => Promise<unknown>;
  disableAppSwitcherProtectionAsync: () => Promise<unknown>;
};

let appSwitcherProtection: AppSwitcherProtectionApi | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  appSwitcherProtection = require('expo-screen-capture') as AppSwitcherProtectionApi;
} catch {
  appSwitcherProtection = null;
}

export function PrivacyShield() {
  const colors = useColors();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const screenCapture = appSwitcherProtection;
    if (
      !screenCapture ||
      typeof screenCapture.enableAppSwitcherProtectionAsync !== 'function' ||
      typeof screenCapture.disableAppSwitcherProtectionAsync !== 'function'
    ) {
      return;
    }

    // Disable stays behind enable, including when unmount wins the race.
    const enabled = Promise.resolve()
      .then(() => screenCapture.enableAppSwitcherProtectionAsync())
      .catch(() => undefined);

    return () => {
      void enabled
        .then(() => screenCapture.disableAppSwitcherProtectionAsync())
        .catch(() => undefined);
    };
  }, []);

  if (appState === 'active') return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.shield, { backgroundColor: colors.background }]}
      testID="privacy-shield"
    >
      <BrandLogo size="auth" />
    </View>
  );
}

const styles = StyleSheet.create({
  shield: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10_000,
  },
});
