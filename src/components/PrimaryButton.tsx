import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
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
  const isFilled = variant === 'filled';
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.button,
        isFilled ? styles.filled : styles.outlined,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
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
      borderWidth: 1,
      borderColor: colors.border,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
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
