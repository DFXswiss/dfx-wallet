import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { DfxColors, Typography } from '@/theme';

type Props = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ShortcutAction({ icon, label, onPress, style, testID }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, pressed && styles.pressed, style]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconBubble}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
      <Icon name="chevron-right" size={18} color={DfxColors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(221,229,240,0.9)',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    gap: 10,
    shadowColor: '#0B1426',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: DfxColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    ...Typography.bodyMedium,
    color: DfxColors.primary,
    fontWeight: '700',
  },
});
