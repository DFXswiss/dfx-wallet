import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { GlassSurface } from './GlassSurface';

type Props = {
  icon: ReactNode;
  onPress: () => void;
  /** @default 40 — matches `Header.slotSize` in `theme/layout.ts`. */
  size?: number;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Corner radius scales with size at the same ~0.3 ratio `IconTile` uses
 * (see `theme/layout.ts`), so a button rendered at any size reads as part
 * of the same glass icon-tile family instead of an unrelated one-off.
 */
const RADIUS_RATIO = 0.3;

/**
 * Round glass icon button, extracted from `DashboardHeader`'s original
 * shield/menu markup so any screen can reach for the same control instead
 * of re-composing `Pressable` + `GlassSurface` by hand.
 */
export function GlassIconButton({ icon, onPress, size = 40, accessibilityLabel, testID }: Props) {
  const radius = Math.round(size * RADIUS_RATIO);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      onPress={onPress}
      {...(testID ? { testID } : {})}
    >
      <GlassSurface
        variant="quiet"
        radius={radius}
        style={[styles.button, { width: size, height: size }]}
      >
        {icon}
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
