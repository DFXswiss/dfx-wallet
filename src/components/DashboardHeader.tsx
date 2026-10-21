import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { Icon } from './Icon';
import { useColors, type ThemeColors } from '@/theme';

type Props = {
  onMenuPress?: (() => void) | undefined;
  onShieldPress?: (() => void) | undefined;
};

export function DashboardHeader({ onMenuPress, onShieldPress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {onShieldPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Multi-Sig"
          hitSlop={12}
          onPress={onShieldPress}
          style={styles.iconButton}
          testID="dashboard-shield-button"
        >
          <Icon name="shield" size={26} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} pointerEvents="none" />
      )}
      <BrandLogo size="header" />
      {onMenuPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu"
          hitSlop={12}
          onPress={onMenuPress}
          style={styles.iconButton}
          testID="dashboard-menu-button"
        >
          <Icon name="menu" size={26} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} pointerEvents="none" />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 6,
      paddingBottom: 12,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.cardOverlay,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    iconPlaceholder: {
      width: 44,
      height: 44,
    },
  });
