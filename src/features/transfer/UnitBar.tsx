import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassSurface, Icon } from '@/components';
import { UnitGlyph } from './UnitGlyph';
import { Radius, Spacing, Typography, useColors, type ThemeColors } from '@/theme';

const GLYPH_SIZE = 18;
const CHEVRON_SIZE = 12;
const SEGMENT_HEIGHT = 44;

type Props = {
  /** Units in display order: the asset being sent first, then CHF, then EUR. */
  units: string[];
  active: string;
  /** Unit that stands for the asset itself (the first segment). */
  assetSymbol: string;
  /** More than one asset can be picked: the active asset segment shows a chevron and opens the picker. */
  assetSelectable: boolean;
  onSelect: (unit: string) => void;
};

/**
 * Segmented unit switch under the amount. The active segment sits on a lead
 * glass tile; the asset segment carries a small chevron once it is active,
 * because a second tap on it opens the asset picker.
 */
export function UnitBar({ units, active, assetSymbol, assetSelectable, onSelect }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <GlassSurface variant="quiet" radius={Radius.md} style={styles.bar} testID="send-unit-bar">
      {units.map((unit) => {
        const isActive = unit === active;
        const showChevron = isActive && assetSelectable && unit === assetSymbol;
        const content = (
          <>
            <UnitGlyph symbol={unit} size={GLYPH_SIZE} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{unit}</Text>
            {showChevron && (
              <View style={styles.chevron}>
                <Icon name="chevron-right" size={CHEVRON_SIZE} color={colors.textTertiary} />
              </View>
            )}
          </>
        );
        return (
          <Pressable
            key={unit}
            testID={`send-unit-${unit}`}
            style={styles.segment}
            onPress={() => onSelect(unit)}
            accessibilityRole="button"
            accessibilityLabel={unit}
            accessibilityState={{ selected: isActive }}
          >
            {isActive ? (
              <GlassSurface variant="lead" radius={Radius.sm} style={styles.segmentSurface}>
                {content}
              </GlassSurface>
            ) : (
              <View style={styles.segmentSurface}>{content}</View>
            )}
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      padding: Spacing.xs,
      gap: Spacing.xs,
    },
    segment: {
      flex: 1,
    },
    segmentSurface: {
      minHeight: SEGMENT_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    label: {
      ...Typography.bodyMedium,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    labelActive: {
      fontWeight: '700',
      color: colors.text,
    },
    chevron: {
      transform: [{ rotate: '90deg' }],
    },
  });
