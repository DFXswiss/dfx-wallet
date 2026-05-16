import { ReactNode, useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { Typography, useColors, type ThemeColors } from '@/theme';

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
      style={({ pressed }) => [styles.pill, pressed && styles.pressed, style]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconBubble}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.primary} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 60,
      backgroundColor: colors.cardOverlay,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.cardOverlayBorder,
      paddingVertical: 10,
      paddingLeft: 10,
      paddingRight: 14,
      gap: 10,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    pressed: {
      opacity: 0.85,
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
