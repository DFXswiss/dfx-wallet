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
      style={[styles.pill, style]}
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
    backgroundColor: DfxColors.surface,
    borderRadius: 999,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 16,
    gap: 12,
    shadowColor: '#0B1426',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DfxColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    ...Typography.bodyLarge,
    color: DfxColors.primary,
    fontWeight: '600',
  },
});
