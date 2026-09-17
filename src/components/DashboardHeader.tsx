import { Pressable, StyleSheet, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { GlassSurface } from './GlassSurface';
import { Icon } from './Icon';
import { useColors } from '@/theme';

type Props = {
  onMenuPress?: (() => void) | undefined;
  onShieldPress?: (() => void) | undefined;
};

export function DashboardHeader({ onMenuPress, onShieldPress }: Props) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      {onShieldPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Multi-Sig"
          hitSlop={12}
          onPress={onShieldPress}
          testID="dashboard-shield-button"
        >
          <GlassSurface variant="quiet" radius={14} style={styles.iconButton}>
            <Icon name="shield" size={26} color={colors.primary} strokeWidth={2.5} />
          </GlassSurface>
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
          testID="dashboard-menu-button"
        >
          <GlassSurface variant="quiet" radius={14} style={styles.iconButton}>
            <Icon name="menu" size={26} color={colors.primary} strokeWidth={2.5} />
          </GlassSurface>
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
  },
});
