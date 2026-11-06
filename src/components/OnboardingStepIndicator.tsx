import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors, type ThemeColors } from '@/theme';

type Props = {
  current: number;
  total?: number;
};

export function OnboardingStepIndicator({ current, total = 3 }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      {Array.from({ length: total }).map((_, index) => {
        const active = index + 1 <= current;
        return <View key={index} style={[styles.step, active && styles.stepActive]} />;
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignSelf: 'center',
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
  });
