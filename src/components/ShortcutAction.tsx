import { ReactNode, useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { Icon } from './Icon';
import { Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ShortcutAction({ icon, label, onPress, style, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [pressed && styles.pressed, style]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <GlassSurface variant="default" radius={22} style={styles.pill}>
        <View style={styles.iconBubble}>{icon}</View>
        <Text style={styles.label}>{label}</Text>
        <Icon name="chevron-right" size={18} color={colors.primary} />
      </GlassSurface>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      minHeight: 60,
      paddingVertical: 10,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.md,
      gap: 10,
    },
    pressed: {
      transform: [{ scale: 0.985 }],
      opacity: 0.9,
    },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      flex: 1,
      ...Typography.bodyMedium,
      color: colors.primary,
      fontWeight: '700',
    },
  });
