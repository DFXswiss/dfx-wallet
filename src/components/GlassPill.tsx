import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassSurface } from './GlassSurface';
import {
  Card,
  Interaction,
  Radius,
  Spacing,
  Typography,
  glassToneEdge,
  useColors,
  type GlassTone,
} from '@/theme';

type Shape = 'pill' | 'tile' | 'rounded';

type Props = {
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Semantic edge tint layered on top of the pill's own variant. */
  tone?: GlassTone;
  /** `tile` widens the pill into a `Radius.lg` block for multi-line,
   *  full-width selection tiles (e.g. quorum options). `rounded` keeps the
   *  compact, single-line `pill` padding and outer `Pressable` but swaps the
   *  oval `Radius.pill` corner for a squarer `Radius.sm` one. @default 'pill' */
  shape?: Shape;
  /** Reaches the outer `Pressable` (width/flex). */
  style?: StyleProp<ViewStyle>;
  /** Reaches the inner glass surface. */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  children: ReactNode;
};

/**
 * Glass pill control for segmented choices (e.g. Kauf/Verkauf toggles,
 * filter chips) and, with `shape="tile"`, wide multi-line selection tiles.
 * `selected` switches to the `lead` glass variant, sets
 * `accessibilityState.selected` (unless the caller overrides it), and tints
 * a text child with `colors.primary`; non-text children render as-is.
 */
export function GlassPill({
  selected = false,
  onPress,
  disabled = false,
  tone = 'default',
  shape = 'pill',
  style,
  contentStyle,
  testID,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  children,
}: Props) {
  const colors = useColors();
  const toneEdge = glassToneEdge(tone, colors);
  const content =
    typeof children === 'string' ? (
      <Text style={[styles.label, { color: selected ? colors.primary : colors.text }]}>
        {children}
      </Text>
    ) : (
      children
    );
  const resolvedAccessibilityState = accessibilityState ?? { selected };
  const interactionDisabled = disabled || !onPress;
  // Pressed feedback is tracked in real state — see the same note in
  // `GlassCard` for why `Pressable`'s own render-prop can't be used here.
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      {...(onPress ? { onPress } : {})}
      disabled={interactionDisabled}
      onPressIn={() => {
        if (!interactionDisabled) setPressed(true);
      }}
      onPressOut={() => {
        if (!interactionDisabled) setPressed(false);
      }}
      style={[shape === 'tile' ? styles.pressableTile : styles.pressable, style]}
      accessibilityState={resolvedAccessibilityState}
      {...(testID ? { testID } : {})}
      {...(accessibilityRole ? { accessibilityRole } : {})}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(accessibilityHint ? { accessibilityHint } : {})}
    >
      <GlassSurface
        variant={pressed && !disabled ? 'lead' : selected ? 'lead' : 'default'}
        radius={shape === 'tile' ? Radius.lg : shape === 'rounded' ? Radius.sm : Radius.pill}
        style={[
          shape === 'tile' ? styles.tile : styles.pill,
          toneEdge,
          disabled && { opacity: Interaction.disabledOpacity },
          contentStyle,
        ]}
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
  pressableTile: {
    alignSelf: 'stretch',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Card.padding,
  },
  label: {
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
});
