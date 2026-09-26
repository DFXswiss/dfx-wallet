import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassSurface } from './GlassSurface';
import { Interaction } from '@/theme';

type Props = {
  icon: ReactNode;
  onPress: () => void;
  /** @default 40 — matches `Header.slotSize` in `theme/layout.ts`. */
  size?: number;
  /** Dims the button (`Interaction.disabledOpacity`) and drops the callback. */
  disabled?: boolean;
  /** Reaches the outer `Pressable` (width/flex). */
  style?: StyleProp<ViewStyle>;
  /** Reaches the inner glass surface. */
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
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
export function GlassIconButton({
  icon,
  onPress,
  size = 40,
  disabled = false,
  style,
  contentStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  testID,
}: Props) {
  const radius = Math.round(size * RADIUS_RATIO);
  // Pressed feedback is tracked in real state — see the same note in
  // `GlassCard` for why `Pressable`'s own render-prop can't be used here.
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      {...(accessibilityState ? { accessibilityState } : {})}
      hitSlop={12}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) setPressed(true);
      }}
      onPressOut={() => {
        if (!disabled) setPressed(false);
      }}
      disabled={disabled}
      style={style}
      {...(testID ? { testID } : {})}
    >
      <GlassSurface
        variant={pressed && !disabled ? 'lead' : 'quiet'}
        radius={radius}
        style={[
          styles.button,
          { width: size, height: size },
          disabled && { opacity: Interaction.disabledOpacity },
          contentStyle,
        ]}
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
