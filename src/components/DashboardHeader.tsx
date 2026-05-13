import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { DfxColors } from '@/theme';

type Props = {
  onMenuPress: () => void;
  onShieldPress?: () => void;
};

export function DashboardHeader({ onMenuPress, onShieldPress }: Props) {
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
          <Icon name="shield" size={26} color={DfxColors.primary} strokeWidth={2.5} />
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} pointerEvents="none" />
      )}
      <Image
        source={require('../../assets/dfx-logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="DFX"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menu"
        hitSlop={12}
        onPress={onMenuPress}
        style={styles.iconButton}
        testID="dashboard-menu-button"
      >
        <Icon name="menu" size={26} color={DfxColors.primary} strokeWidth={2.5} />
      </Pressable>
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
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(221,229,240,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1426',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
  },
  logo: {
    height: 32,
    width: 116,
  },
});
