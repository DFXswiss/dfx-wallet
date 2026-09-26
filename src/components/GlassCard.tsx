import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassSurface, type GlassVariant } from './GlassSurface';
import { Card } from '@/theme';

type Props = {
  variant?: GlassVariant;
  /** @default `Card.padding` */
  padding?: number;
  /** @default `Card.radius` */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

/**
 * Standard content card on glass — the shared shell for any card-shaped
 * block (asset summaries, settings sections, grouped info). Screens should
 * reach for this instead of composing `GlassSurface` + padding by hand, so
 * a change to `Card` tokens or the glass recipe reaches every card at once.
 */
export function GlassCard({
  variant = 'default',
  padding = Card.padding,
  radius = Card.radius,
  style,
  testID,
  children,
}: Props) {
  return (
    <GlassSurface
      variant={variant}
      radius={radius}
      style={[{ padding }, style]}
      {...(testID ? { testID } : {})}
    >
      {children}
    </GlassSurface>
  );
}
