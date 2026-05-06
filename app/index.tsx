import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';
import { DfxColors } from '@/theme';

export default function Index() {
  const { isOnboarded, isAuthenticated, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={DfxColors.primary} />
      </View>
    );
  }

  if (!isOnboarded) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(pin)/verify" />;
  }

  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: DfxColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
