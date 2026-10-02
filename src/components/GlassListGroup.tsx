import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassSurface, type GlassVariant } from './GlassSurface';
import {
  Card,
  Interaction,
  glassToneEdge,
  useColors,
  useGlassRecipe,
  type GlassTone,
} from '@/theme';

type GroupProps = {
  variant?: GlassVariant;
  /** Semantic edge tint for the whole group. */
  tone?: GlassTone;
  /** @default `Card.radius` */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

/**
 * Glass container for a group of list rows (settings sections, grouped
 * summaries). Clips its rows to the same rounded corners as the surface —
 * pair with `GlassListGroup.Row` for the divider/press behaviour.
 */
function GlassListGroupBase({
  variant = 'default',
  tone = 'default',
  radius = Card.radius,
  style,
  testID,
  children,
}: GroupProps) {
  const colors = useColors();
  const toneEdge = glassToneEdge(tone, colors);

  return (
    <GlassSurface
      variant={variant}
      radius={radius}
      style={[styles.group, toneEdge, style]}
      {...(testID ? { testID } : {})}
    >
      {children}
    </GlassSurface>
  );
}

type RowProps = {
  onPress?: () => void;
  /** Dims the row and drops the callback. Has no effect without `onPress`. */
  disabled?: boolean;
  /** The caller marks the last row explicitly (e.g. `i === rows.length - 1`)
   *  so it renders without a trailing divider. */
  last?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  children?: ReactNode;
};

function GlassListRow({
  onPress,
  disabled = false,
  last = false,
  style,
  testID,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  children,
}: RowProps) {
  const colors = useColors();
  const recipe = useGlassRecipe();
  // Pressed feedback is tracked in real state — see the same note in
  // `GlassCard` for why `Pressable`'s own render-prop can't be used here.
  const [pressed, setPressed] = useState(false);
  const rowStyle = [
    styles.row,
    !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
    style,
  ];

  if (!onPress) {
    return (
      <View style={rowStyle} {...(testID ? { testID } : {})}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) setPressed(true);
      }}
      onPressOut={() => {
        if (!disabled) setPressed(false);
      }}
      disabled={disabled}
      {...(testID ? { testID } : {})}
      {...(accessibilityRole ? { accessibilityRole } : {})}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      {...(accessibilityState ? { accessibilityState } : {})}
    >
      <View
        style={[
          rowStyle,
          // Rows share one `GlassSurface` (the group's), so press feedback
          // reuses its `lead` overlay recipe as a background tint instead
          // of nesting a second blur/edge-stroke per row.
          pressed && !disabled && { backgroundColor: recipe.overlay('lead') },
          disabled && { opacity: Interaction.disabledOpacity },
        ]}
      >
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: Card.padding,
    paddingVertical: Card.padding,
  },
});

export const GlassListGroup = Object.assign(GlassListGroupBase, { Row: GlassListRow });
