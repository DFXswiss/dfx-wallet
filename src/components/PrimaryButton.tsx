import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useReduceMotion } from '@/hooks';
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'filled' | 'outlined';
  testID?: string;
};

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'filled',
  testID,
}: Props) {
  const colors = useColors();
  const reduce = useReduceMotion();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isFilled = variant === 'filled';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        isFilled ? styles.filled : styles.outlined,
        (disabled || loading) && styles.disabled,
        pressed && (reduce ? styles.pressedReduced : styles.pressed),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isFilled ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.text, !isFilled && styles.outlinedText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    filled: {
      backgroundColor: colors.primary,
      shadowColor: colors.primaryDark,
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 3,
    },
    outlined: {
      backgroundColor: colors.cardOverlay,
      borderWidth: 1.5,
      // Outline uses the primary tint at low-medium opacity so the
      // secondary CTA reads as a real "ghost" button on dark surfaces
      // instead of disappearing into the card-coloured background.
      borderColor: colors.primary,
    },
    disabled: {
      opacity: 0.5,
    },
    // Opacity-only press feedback — no scale transforms to avoid layout shift.
    pressed: {
      opacity: 0.85,
    },
    pressedReduced: {
      opacity: 0.85,
    },
    text: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.white,
    },
    outlinedText: {
      color: colors.primary,
    },
  });
