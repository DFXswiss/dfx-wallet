import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  current: number;
  total?: number;
  showLabel?: boolean;
};

export function OnboardingStepIndicator({ current, total = 3, showLabel = true }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = `${current}/${total}`;
  return (
    <View
      style={styles.wrapper}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${label}`}
    >
      <View style={styles.container}>
        {Array.from({ length: total }).map((_, index) => {
          const active = index + 1 <= current;
          return <View key={index} style={[styles.step, active && styles.stepActive]} />;
        })}
      </View>
      {showLabel ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      alignSelf: 'center',
      alignItems: 'center',
      gap: 6,
    },
    container: {
      flexDirection: 'row',
      gap: 8,
    },
    step: {
      width: 28,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    stepActive: {
      backgroundColor: colors.primary,
    },
    label: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      fontWeight: '600',
      letterSpacing: 1,
    },
  });
