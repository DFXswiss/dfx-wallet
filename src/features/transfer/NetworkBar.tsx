import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/GlassSurface';
import { Radius, Typography, useColors, type ThemeColors } from '@/theme';

export type NetworkBarOption = {
  key: string;
  label: string;
  caption: string;
};

type Props = {
  options: NetworkBarOption[];
  value: string;
  onChange: (key: string) => void;
  testIDPrefix: string;
};

export function NetworkBar({ options, value, onChange, testIDPrefix }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isLocked = options.length === 1;

  return (
    <GlassSurface
      variant="quiet"
      radius={Radius.sm}
      style={styles.container}
      testID={`${testIDPrefix}-bar`}
    >
      {options.map((option) => {
        const selected = option.key === value;

        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: isLocked }}
            disabled={isLocked}
            onPress={() => {
              if (!selected) onChange(option.key);
            }}
            style={[styles.segment, selected && styles.segmentSelected]}
            testID={`${testIDPrefix}-${option.key}`}
          >
            <Text
              style={[styles.label, (selected || isLocked) && styles.textSelected]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {option.label}
            </Text>
            <Text
              style={[styles.caption, (selected || isLocked) && styles.textSelected]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {option.caption}
            </Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      gap: 4,
      padding: 4,
    },
    segment: {
      flex: 1,
      height: 44,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentSelected: {
      backgroundColor: colors.card,
      shadowColor: colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    label: {
      ...Typography.networkLabel,
      color: colors.textSecondary,
    },
    caption: {
      ...Typography.networkCaption,
      color: colors.textSecondary,
      opacity: 0.8,
    },
    textSelected: {
      color: colors.text,
    },
  });
