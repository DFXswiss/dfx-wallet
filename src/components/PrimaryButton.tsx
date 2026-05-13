import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { DfxColors, Typography } from '@/theme';

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
        <ActivityIndicator color={isFilled ? DfxColors.white : DfxColors.primary} />
      ) : (
        <Text style={[styles.text, !isFilled && styles.outlinedText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  filled: {
    backgroundColor: DfxColors.primary,
    shadowColor: DfxColors.primaryDark,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  outlined: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: DfxColors.border,
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
    color: DfxColors.white,
  },
  outlinedText: {
    color: DfxColors.primary,
  },
});
