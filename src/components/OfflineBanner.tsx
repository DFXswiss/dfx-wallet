import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { useColors, type ThemeColors, Typography } from '@/theme';

/**
 * Shows a banner when the device is offline.
 * Mount in the root layout to show across all screens.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const netInfo = useNetInfo();

  if (netInfo.isConnected !== false) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('offline.message')}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.offlineBanner,
      paddingVertical: 8,
      alignItems: 'center',
    },
    text: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.offlineBannerText,
    },
  });
