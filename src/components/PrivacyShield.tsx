import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { useColors } from '@/theme';

export function PrivacyShield() {
  const colors = useColors();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
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
