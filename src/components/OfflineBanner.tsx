import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useColors, type ThemeColors, Typography } from '@/theme';

/**
 * Shows a banner when the device is offline.
 * Mount in the root layout to show across all screens.
 */
export function OfflineBanner() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const netInfo = useNetInfo();

  if (netInfo.isConnected !== false) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.error,
      paddingVertical: 8,
      alignItems: 'center',
    },
    text: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.white,
    },
  });
