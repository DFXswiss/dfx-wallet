import { StyleSheet, View } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { GlassIconButton } from './GlassIconButton';
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
        <GlassIconButton
          icon={<Icon name="shield" size={26} color={colors.primary} strokeWidth={2.5} />}
          onPress={onShieldPress}
          size={44}
          accessibilityLabel="Multi-Sig"
          testID="dashboard-shield-button"
        />
      ) : (
        <View style={styles.iconPlaceholder} pointerEvents="none" />
      )}
      <BrandLogo size="header" />
      {onMenuPress ? (
        <GlassIconButton
          icon={<Icon name="menu" size={26} color={colors.primary} strokeWidth={2.5} />}
          onPress={onMenuPress}
          size={44}
          accessibilityLabel="Menu"
          testID="dashboard-menu-button"
        />
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
  iconPlaceholder: {
    width: 44,
    height: 44,
  },
});
