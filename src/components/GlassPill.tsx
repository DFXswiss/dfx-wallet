import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { Radius, Typography, useColors } from '@/theme';

type Props = {
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
};

/**
 * Glass pill control for segmented choices (e.g. Kauf/Verkauf toggles,
 * filter chips). `selected` switches to the `lead` glass variant and tints
 * a text child with `colors.primary`; non-text children are rendered as-is.
 */
export function GlassPill({
  selected = false,
  onPress,
  disabled = false,
  style,
  testID,
  children,
}: Props) {
  const colors = useColors();
  const content =
    typeof children === 'string' ? (
      <Text style={[styles.label, selected && { color: colors.primary }]}>{children}</Text>
    ) : (
      children
    );

  return (
    <Pressable
      {...(onPress ? { onPress } : {})}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...(testID ? { testID } : {})}
    >
      <GlassSurface
        variant={selected ? 'lead' : 'default'}
        radius={Radius.pill}
        style={styles.pill}
      >
        {content}
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
