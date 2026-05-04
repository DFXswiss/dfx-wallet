import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DfxColors, Typography } from '@/theme';

type ActionItem = {
  icon: string;
  label: string;
  onPress: () => void;
  testID?: string;
};

type Props = {
  actions: ActionItem[];
};

export function ActionBar({ actions }: Props) {
  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          testID={action.testID}
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{action.icon}</Text>
          </View>
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
  },
  action: {
    alignItems: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DfxColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  label: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
