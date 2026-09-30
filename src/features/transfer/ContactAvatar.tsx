import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassSurface, Icon } from '@/components';
import { UnitGlyph } from './UnitGlyph';
import { avatarColorIndex, contactInitials } from './contacts';
import { DfxColors, Typography, useColors, type ThemeColors } from '@/theme';

const BADGE_SIZE = 20;
const BADGE_GLYPH_SIZE = 14;
const RING_OFFSET = 5;

type Props = {
  /** Contact name; omit for an address without a contact (wallet symbol instead of initials). */
  name?: string;
  size: number;
  /** Symbol of the asset this contact is usually paid in, drawn as a badge bottom right. */
  badgeSymbol?: string;
  /** Accent ring for the most recently used contact. */
  recent?: boolean;
};

/**
 * Avatar fill per colour slot. The palette is the brand set (blue, red,
 * navy, grey) taken from the theme-invariant `DfxColors`, so white initials
 * stay readable on both the light and the dark theme.
 */
function avatarColor(index: number): string {
  switch (index) {
    case 0:
      return DfxColors.primaryDark;
    case 1:
      return DfxColors.brandRed;
    case 2:
      return DfxColors.logoInk;
    default:
      return DfxColors.textSecondary;
  }
}

export function ContactAvatar({ name, size, badgeSymbol, recent = false }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const radius = size / 2;
  const initialsStyle = size >= 56 ? Typography.bodyLarge : Typography.bodyMedium;

  return (
    <View style={{ width: size, height: size }}>
      {recent && (
        <View
          testID="contact-avatar-ring"
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: -RING_OFFSET,
              left: -RING_OFFSET,
              right: -RING_OFFSET,
              bottom: -RING_OFFSET,
              borderRadius: radius + RING_OFFSET,
            },
          ]}
        />
      )}
      {name === undefined ? (
        <GlassSurface
          variant="quiet"
          radius={radius}
          style={[styles.circle, { width: size, height: size }]}
        >
          <Icon name="wallet" size={size / 2} color={colors.primary} />
        </GlassSurface>
      ) : (
        <View
          style={[
            styles.circle,
            { width: size, height: size, borderRadius: radius },
            { backgroundColor: avatarColor(avatarColorIndex(name)) },
          ]}
        >
          <Text style={[initialsStyle, styles.initials]}>{contactInitials(name)}</Text>
        </View>
      )}
      {badgeSymbol && (
        <GlassSurface variant="quiet" radius={BADGE_SIZE / 2} style={styles.badge}>
          <UnitGlyph symbol={badgeSymbol} size={BADGE_GLYPH_SIZE} />
        </GlassSurface>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      color: colors.white,
      fontWeight: '700',
    },
    ring: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    badge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: BADGE_SIZE,
      height: BADGE_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
