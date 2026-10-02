import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type NetworkTextTabOption = {
  key: string;
  label: string;
};

type Props = {
  options: NetworkTextTabOption[];
  value: string;
  onChange: (key: string) => void;
  testIDPrefix: string;
};

export function NetworkTextTabs({ options, value, onChange, testIDPrefix }: Props) {
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
            onPress={() => {
              if (!selected) onChange(option.key);
            }}
            style={styles.tab}
            testID={`${testIDPrefix}-${option.key}`}
          >
            <View style={styles.labelContainer}>
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
              <View style={[styles.indicator, selected && styles.indicatorSelected]} />
            </View>
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
      justifyContent: 'center',
      gap: Spacing.lg,
    },
    tab: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    labelContainer: {
      alignItems: 'center',
      gap: Spacing.xs,
    },
    label: {
      ...Typography.bodySmall,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    labelSelected: {
      color: colors.primary,
    },
    indicator: {
      alignSelf: 'stretch',
      height: 2,
      backgroundColor: colors.transparent,
    },
    indicatorSelected: {
      backgroundColor: colors.primary,
    },
  });
