import { useState, type ReactNode } from 'react';
import {
  Pressable,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassSurface, type GlassVariant } from './GlassSurface';
import { Card, Interaction, glassToneEdge, useColors, type GlassTone } from '@/theme';

type Props = {
  variant?: GlassVariant;
  /** Semantic edge tint layered on top of `variant` — see `glassToneEdge`. */
  tone?: GlassTone;
  /** @default `Card.padding` */
  padding?: number;
  /** @default `Card.radius` */
  radius?: number;
  /** Makes the card itself pressable — renders an internal `Pressable` with
   *  the shared press feedback (glass switches to `lead` while pressed) so
   *  screens no longer need to wrap a `GlassCard` in their own `Pressable`. */
  onPress?: () => void;
  /** Dims the card (`Interaction.disabledOpacity`) and drops the callback.
   *  Has no effect when `onPress` is not set. */
  disabled?: boolean;
  /** Reaches the outer container (width/flex) — the `Pressable` when
   *  `onPress` is set, the glass surface itself otherwise. */
  style?: StyleProp<ViewStyle>;
  /** Reaches the inner glass surface (padding/alignment of the content). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
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
  tone = 'default',
  padding = Card.padding,
  radius = Card.radius,
  onPress,
  disabled = false,
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
  // Pressed feedback is tracked in real state, not read off `Pressable`'s
  // own render-prop: the render prop only reflects the responder system's
  // gesture-recognizer state, which RNTL's synthetic `pressIn`/`pressOut`
  // events don't drive — `onPressIn`/`onPressOut` do fire from those events,
  // so this stays deterministically testable and behaves the same on-device.
  const [pressed, setPressed] = useState(false);

  if (!onPress) {
    return (
      <GlassSurface
        variant={variant}
        radius={radius}
        style={[{ padding }, toneEdge, contentStyle, style]}
        {...(testID ? { testID } : {})}
      >
        {children}
      </GlassSurface>
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
      style={style}
      {...(testID ? { testID } : {})}
      {...(accessibilityRole ? { accessibilityRole } : {})}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      {...(accessibilityState ? { accessibilityState } : {})}
    >
      <GlassSurface
        variant={pressed && !disabled ? 'lead' : variant}
        radius={radius}
        style={[
          { padding },
          toneEdge,
          disabled && { opacity: Interaction.disabledOpacity },
          contentStyle,
        ]}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}
