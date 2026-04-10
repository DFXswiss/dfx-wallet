import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { DfxColors, Typography } from '@/theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'filled' | 'outlined';
};

export function PrimaryButton({ title, onPress, disabled, loading, variant = 'filled' }: Props) {
  const isFilled = variant === 'filled';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  filled: {
    backgroundColor: DfxColors.primary,
  },
  outlined: {
    backgroundColor: DfxColors.transparent,
    borderWidth: 1,
    borderColor: DfxColors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
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
