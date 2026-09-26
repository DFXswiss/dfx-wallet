import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { GlassSurface } from './GlassSurface';
import { Radius, Typography, useColors } from '@/theme';

type Props = TextInputProps & {
  /** Tints the outer ring `colors.error` — does not touch `GlassSurface`'s
   *  own gradient edge. */
  error?: boolean;
  /** Reaches the outer ring (width/flex) — `style` still reaches the
   *  `TextInput` itself, unchanged. */
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * `TextInput` on a `quiet` glass surface. All standard `TextInput` props
 * pass through untouched; `GlassSurface`'s own `onLayout` guard (only
 * re-measures on an actual size change) already keeps typing from
 * triggering a re-layout on every keystroke — this wrapper adds no state
 * of its own.
 */
export const GlassInputField = forwardRef<TextInput, Props>(function GlassInputField(
  { error = false, containerStyle, style, testID, ...inputProps },
  ref,
) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.ring,
        { borderColor: colors.transparent },
        error && { borderColor: colors.error, borderWidth: 1.5 },
        containerStyle,
      ]}
    >
      <GlassSurface variant="quiet" radius={Radius.sm} style={styles.surface}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.text }, style]}
          {...(testID ? { testID } : {})}
          {...inputProps}
        />
      </GlassSurface>
    </View>
  );
});

const styles = StyleSheet.create({
  ring: {
    borderRadius: Radius.sm,
    borderWidth: 0,
  },
  surface: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    ...Typography.bodyLarge,
  },
});
