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
        <View style={styles.iconButton} />
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
    paddingTop: 4,
    paddingBottom: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 30,
    width: 110,
  },
});
