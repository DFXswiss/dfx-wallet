import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { DfxColors, Typography } from '@/theme';

/**
 * Shows a banner when the device is offline.
 * Mount in the root layout to show across all screens.
 */
export function OfflineBanner() {
  const netInfo = useNetInfo();

  if (netInfo.isConnected !== false) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: DfxColors.error,
    paddingVertical: 8,
    alignItems: 'center',
  },
  text: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: DfxColors.white,
  },
});
