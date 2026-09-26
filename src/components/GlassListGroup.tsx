import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassSurface, type GlassVariant } from './GlassSurface';
import { Card, useColors } from '@/theme';

type GroupProps = {
  variant?: GlassVariant;
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
  radius = Card.radius,
  style,
  testID,
  children,
}: GroupProps) {
  return (
    <GlassSurface
      variant={variant}
      radius={radius}
      style={[styles.group, style]}
      {...(testID ? { testID } : {})}
    >
      {children}
    </GlassSurface>
  );
}

type RowProps = {
  onPress?: () => void;
  /** The caller marks the last row explicitly (e.g. `i === rows.length - 1`)
   *  so it renders without a trailing divider. */
  last?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

function GlassListRow({ onPress, last = false, style, testID, children }: RowProps) {
  const colors = useColors();
  const Container = onPress ? Pressable : View;
  const rowStyle = [
    styles.row,
    !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
    style,
  ];
  // `Container` is `Pressable | View` — a plain object literal here would
  // fail against the narrower of the two prop types (View has no
  // `onPress`), so it's assembled once and spread with a cast, matching
  // the existing `TransactionRow` pattern for the same union.
  const containerProps = onPress
    ? { onPress, style: rowStyle, testID }
    : { style: rowStyle, testID };

  return <Container {...(containerProps as object)}>{children}</Container>;
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
