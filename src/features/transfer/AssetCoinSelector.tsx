import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { UnitGlyph } from '@/features/transfer/UnitGlyph';
import { Spacing, Typography, useColors, type ThemeColors } from '@/theme';

const GLYPH_SIZE = 44;
const RING_GAP = 3;
const RING_WIDTH = 2;
const COIN_FRAME_SIZE = GLYPH_SIZE + 2 * (RING_GAP + RING_WIDTH);

type AssetCoinOption = {
  key: string;
  symbol: string;
};

type Props = {
  options: AssetCoinOption[];
  value: string;
  onChange: (key: string) => void;
  testIDPrefix: string;
};

export function AssetCoinSelector({ options, value, onChange, testIDPrefix }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {options.map((option) => {
        const selected = option.key === value;

        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.symbol}
            onPress={() => {
              if (!selected) onChange(option.key);
            }}
            style={styles.option}
            testID={`${testIDPrefix}-${option.key}`}
          >
            <View style={[styles.coinFrame, selected && styles.coinFrameSelected]}>
              <UnitGlyph symbol={option.symbol} size={GLYPH_SIZE} />
              {selected && (
                <View style={styles.checkBadge} testID={`${testIDPrefix}-${option.key}-check`}>
                  <Icon name="check" size={10} color={colors.white} strokeWidth={3} />
                </View>
              )}
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.symbol}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignSelf: 'stretch',
    },
    option: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      gap: Spacing.xs,
    },
    coinFrame: {
      position: 'relative',
      width: COIN_FRAME_SIZE,
      height: COIN_FRAME_SIZE,
      borderRadius: COIN_FRAME_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coinFrameSelected: {
      borderWidth: RING_WIDTH,
      borderColor: colors.primary,
      padding: RING_GAP,
      backgroundColor: colors.background,
    },
    checkBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.background,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    labelSelected: {
      color: colors.text,
      fontWeight: '700',
    },
  });
